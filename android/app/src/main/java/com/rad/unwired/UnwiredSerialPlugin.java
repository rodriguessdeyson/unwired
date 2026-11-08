package com.rad.unwired;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
    name = "UnwiredSerial",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT }),
        @Permission(alias = "legacyLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class UnwiredSerialPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int READ_BUFFER_BYTES = 4096;
    private static final int BATCH_INTERVAL_MS = 40;
    private static final int TCP_CONNECT_TIMEOUT_MS = 4000;

    private final Map<String, Connection> connections = new ConcurrentHashMap<>();
    private final AtomicInteger nextId = new AtomicInteger(1);
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final ScheduledExecutorService batcher = Executors.newSingleThreadScheduledExecutor();
    private BroadcastReceiver discoveryReceiver;

    @Override
    public void load() {
        batcher.scheduleWithFixedDelay(this::flushAll, BATCH_INTERVAL_MS, BATCH_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscoveryInternal();
        for (Connection connection : connections.values()) connection.close();
        batcher.shutdownNow();
        workers.shutdownNow();
    }

    // Permissões e estado do Bluetooth

    @PluginMethod
    public void requestBluetooth(PluginCall call) {
        String alias = bluetoothAlias();
        if (getPermissionState(alias) == PermissionState.GRANTED) {
            resolveGranted(call, true);
        } else {
            requestPermissionForAlias(alias, call, "bluetoothPermissionResult");
        }
    }

    @PermissionCallback
    private void bluetoothPermissionResult(PluginCall call) {
        resolveGranted(call, getPermissionState(bluetoothAlias()) == PermissionState.GRANTED);
    }

    private String bluetoothAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "legacyLocation";
    }

    private void resolveGranted(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        resolveEnabled(call);
    }

    /** Pede ao sistema para ligar. O app nunca liga nem desliga o Bluetooth por conta própria. */
    @SuppressLint("MissingPermission")
    @PluginMethod
    public void enable(PluginCall call) {
        if (adapter() == null) {
            call.reject("Bluetooth indisponível");
            return;
        }
        startActivityForResult(call, new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), "enableResult");
    }

    @ActivityCallback
    private void enableResult(PluginCall call, ActivityResult result) {
        if (call != null) resolveEnabled(call);
    }

    private void resolveEnabled(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSObject result = new JSObject();
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    // Descoberta de módulos clássicos

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void bondedDevices(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSArray devices = new JSArray();
        if (adapter != null) {
            try {
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                for (BluetoothDevice device : bonded) devices.put(describe(device, true, null));
            } catch (SecurityException error) {
                call.reject("Sem permissão", error);
                return;
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void startDiscovery(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            call.reject("Bluetooth indisponível");
            return;
        }
        stopDiscoveryInternal();
        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device == null) return;
                    short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE);
                    notifyListeners("classicDevice", describe(device, device.getBondState() == BluetoothDevice.BOND_BONDED, rssi == Short.MIN_VALUE ? null : (int) rssi));
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(intent.getAction())) {
                    notifyListeners("discoveryFinished", new JSObject());
                }
            }
        };
        IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        ContextCompat.registerReceiver(getContext(), discoveryReceiver, filter, ContextCompat.RECEIVER_EXPORTED);
        try {
            adapter.startDiscovery();
            call.resolve();
        } catch (SecurityException error) {
            stopDiscoveryInternal();
            call.reject("Sem permissão", error);
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        stopDiscoveryInternal();
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    private void stopDiscoveryInternal() {
        if (discoveryReceiver != null) {
            try {
                getContext().unregisterReceiver(discoveryReceiver);
            } catch (IllegalArgumentException ignored) {
                // O receptor já tinha sido removido.
            }
            discoveryReceiver = null;
        }
        BluetoothAdapter adapter = adapter();
        if (adapter != null) {
            try {
                adapter.cancelDiscovery();
            } catch (SecurityException ignored) {
                // Sem permissão, nenhuma descoberta foi iniciada.
            }
        }
    }

    @SuppressLint("MissingPermission")
    private JSObject describe(BluetoothDevice device, boolean paired, Integer rssi) {
        JSObject item = new JSObject();
        String name = device.getName();
        item.put("name", name == null ? "" : name);
        item.put("address", device.getAddress());
        item.put("paired", paired);
        if (rssi != null) item.put("rssi", rssi);
        // Classe principal (áudio, celular, computador...), usada para filtrar a busca.
        android.bluetooth.BluetoothClass type = device.getBluetoothClass();
        if (type != null) item.put("major", type.getMajorDeviceClass());
        return item;
    }

    // Conexões

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connectSpp(PluginCall call) {
        String address = call.getString("address");
        BluetoothAdapter adapter = adapter();
        if (address == null || adapter == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            call.reject("Endereço inválido");
            return;
        }
        workers.execute(() -> {
            try {
                adapter.cancelDiscovery();
                BluetoothSocket socket = openSpp(adapter.getRemoteDevice(address));
                register(call, socket, socket.getInputStream(), socket.getOutputStream());
            } catch (IOException | SecurityException error) {
                call.reject("Falha ao conectar", error instanceof Exception ? (Exception) error : null);
            }
        });
    }

    /** Tenta o canal seguro; módulos baratos como o HC-05 costumam exigir o inseguro. */
    @SuppressLint("MissingPermission")
    private BluetoothSocket openSpp(BluetoothDevice device) throws IOException {
        BluetoothSocket secure = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            secure.connect();
            return secure;
        } catch (IOException firstError) {
            closeQuietly(secure);
            BluetoothSocket insecure = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            try {
                insecure.connect();
                return insecure;
            } catch (IOException secondError) {
                closeQuietly(insecure);
                throw secondError;
            }
        }
    }

    @PluginMethod
    public void connectTcp(PluginCall call) {
        String host = call.getString("host");
        Integer port = call.getInt("port");
        if (host == null || port == null) {
            call.reject("Endereço inválido");
            return;
        }
        workers.execute(() -> {
            Socket socket = new Socket();
            try {
                socket.setTcpNoDelay(true);
                socket.connect(new InetSocketAddress(host, port), TCP_CONNECT_TIMEOUT_MS);
                register(call, socket, socket.getInputStream(), socket.getOutputStream());
            } catch (IOException error) {
                closeQuietly(socket);
                call.reject("Falha ao conectar", error);
            }
        });
    }

    private void register(PluginCall call, Closeable socket, InputStream input, OutputStream output) {
        String id = String.valueOf(nextId.getAndIncrement());
        Connection connection = new Connection(id, socket, input, output);
        connections.put(id, connection);
        JSObject result = new JSObject();
        result.put("id", id);
        call.resolve(result);
        workers.execute(connection::readLoop);
    }

    @PluginMethod
    public void write(PluginCall call) {
        Connection connection = connections.get(String.valueOf(call.getString("id")));
        String data = call.getString("data");
        if (connection == null || data == null) {
            call.reject("Conexão fechada");
            return;
        }
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        workers.execute(() -> {
            try {
                connection.write(bytes);
                call.resolve();
            } catch (IOException error) {
                call.reject("Falha ao enviar", error);
            }
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        Connection connection = connections.get(String.valueOf(call.getString("id")));
        if (connection != null) workers.execute(connection::close);
        call.resolve();
    }

    private void flushAll() {
        for (Connection connection : connections.values()) connection.flush();
    }

    private final class Connection {
        private final String id;
        private final Closeable socket;
        private final InputStream input;
        private final OutputStream output;
        private final ByteArrayOutputStream pending = new ByteArrayOutputStream();
        private volatile boolean closed;

        Connection(String id, Closeable socket, InputStream input, OutputStream output) {
            this.id = id;
            this.socket = socket;
            this.input = input;
            this.output = output;
        }

        void readLoop() {
            byte[] buffer = new byte[READ_BUFFER_BYTES];
            String error = null;
            try {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    synchronized (pending) {
                        pending.write(buffer, 0, count);
                    }
                }
            } catch (IOException readError) {
                error = readError.getMessage();
            }
            finish(error);
        }

        /** Junta os bytes em lotes para não atravessar a ponte com a WebView a cada pacote. */
        void flush() {
            byte[] bytes;
            synchronized (pending) {
                if (pending.size() == 0) return;
                bytes = pending.toByteArray();
                pending.reset();
            }
            JSObject event = new JSObject();
            event.put("id", id);
            event.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            notifyListeners("data", event);
        }

        synchronized void write(byte[] bytes) throws IOException {
            output.write(bytes);
            output.flush();
        }

        void close() {
            closed = true;
            closeQuietly(socket);
        }

        private void finish(String error) {
            flush();
            connections.remove(id);
            closeQuietly(socket);
            JSObject event = new JSObject();
            event.put("id", id);
            if (error != null && !closed) event.put("error", error);
            notifyListeners("closed", event);
        }
    }

    private static void closeQuietly(Closeable closeable) {
        try {
            closeable.close();
        } catch (IOException ignored) {
            // Nada a fazer: a conexão já está encerrando.
        }
    }

    // Descoberta por Wi-Fi

    @PluginMethod
    public void udpDiscover(PluginCall call) {
        List<String> messages;
        try {
            messages = call.getArray("messages").toList();
        } catch (Exception error) {
            call.reject("Mensagens inválidas", error);
            return;
        }
        int port = call.getInt("port", 4210);
        int timeoutMs = call.getInt("timeoutMs", 3000);
        workers.execute(() -> {
            WifiManager wifi = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiManager.MulticastLock lock = wifi == null ? null : wifi.createMulticastLock("unwired-discovery");
            try (DatagramSocket socket = new DatagramSocket()) {
                if (lock != null) lock.acquire();
                socket.setBroadcast(true);
                for (InetAddress target : broadcastTargets()) {
                    for (String message : messages) {
                        byte[] data = message.getBytes(StandardCharsets.UTF_8);
                        try {
                            socket.send(new DatagramPacket(data, data.length, target, port));
                        } catch (IOException ignored) {
                            // Um destino pode falhar; os demais continuam.
                        }
                    }
                }
                call.resolve(collectResponses(socket, timeoutMs));
            } catch (IOException error) {
                call.reject("Falha na descoberta", error);
            } finally {
                if (lock != null && lock.isHeld()) lock.release();
            }
        });
    }

    /** Escuta até o tempo acabar: pode haver vários dispositivos na rede. */
    private JSObject collectResponses(DatagramSocket socket, int timeoutMs) throws IOException {
        Map<String, String> found = new LinkedHashMap<>();
        long deadline = System.currentTimeMillis() + timeoutMs;
        byte[] buffer = new byte[255];
        while (true) {
            long remaining = deadline - System.currentTimeMillis();
            if (remaining <= 0) break;
            socket.setSoTimeout((int) remaining);
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            try {
                socket.receive(packet);
            } catch (SocketTimeoutException timeout) {
                break;
            }
            String response = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
            found.put(packet.getAddress().getHostAddress(), response);
        }
        JSArray devices = new JSArray();
        for (Map.Entry<String, String> entry : found.entrySet()) {
            JSObject device = new JSObject();
            device.put("address", entry.getKey());
            device.put("response", entry.getValue());
            devices.put(device);
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        return result;
    }

    private List<InetAddress> broadcastTargets() throws IOException {
        List<InetAddress> targets = new ArrayList<>();
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        if (interfaces != null) {
            for (NetworkInterface network : Collections.list(interfaces)) {
                if (!network.isUp() || network.isLoopback()) continue;
                for (InterfaceAddress address : network.getInterfaceAddresses()) {
                    if (address.getBroadcast() != null) targets.add(address.getBroadcast());
                }
            }
        }
        targets.add(InetAddress.getByName("255.255.255.255"));
        return targets;
    }

    // Tela

    /** Com uma sessão aberta, a tela não apaga nem bloqueia sozinha. */
    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            int flag = android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
            if (enabled) getActivity().getWindow().addFlags(flag);
            else getActivity().getWindow().clearFlags(flag);
            call.resolve();
        });
    }

    // Teclado

    @PluginMethod
    public void showKeyboard(PluginCall call) {
        android.webkit.WebView webView = getBridge().getWebView();
        // O WebView precisa de um instante para ligar o campo recém-focado ao teclado.
        webView.postDelayed(() -> {
            android.view.inputmethod.InputMethodManager keyboard =
                (android.view.inputmethod.InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
            webView.requestFocus();
            keyboard.showSoftInput(webView, 0);
            call.resolve();
        }, 350);
    }

    // Exportação

    @PluginMethod
    public void writeCacheFile(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || data == null || name.contains("/") || name.contains("\\") || name.startsWith(".")) {
            call.reject("Arquivo inválido");
            return;
        }
        workers.execute(() -> {
            File file = new File(getContext().getCacheDir(), name);
            try (FileOutputStream stream = new FileOutputStream(file)) {
                stream.write(Base64.decode(data, Base64.DEFAULT));
                JSObject result = new JSObject();
                result.put("uri", "file://" + file.getAbsolutePath());
                call.resolve(result);
            } catch (IOException error) {
                call.reject("Falha ao gravar", error);
            }
        });
    }

    // Migração do app antigo

    /** O PreferenceManager do app antigo grava em <pacote>_preferences. */
    @PluginMethod
    public void legacyPreferences(PluginCall call) {
        Context context = getContext();
        SharedPreferences preferences = context.getSharedPreferences(context.getPackageName() + "_preferences", Activity.MODE_PRIVATE);
        JSObject values = new JSObject();
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            if (entry.getValue() instanceof String) values.put(entry.getKey(), (String) entry.getValue());
        }
        JSObject result = new JSObject();
        result.put("values", values);
        call.resolve(result);
    }
}
