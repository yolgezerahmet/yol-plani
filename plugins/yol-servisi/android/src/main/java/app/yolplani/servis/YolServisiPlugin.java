package app.yolplani.servis;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS köprüsü. Asıl iş YolServisi'nde; burası komutları servise iletir, servisten gelen
 * olayları (tik, konum, eylem) JS dinleyicilerine yayar.
 */
@CapacitorPlugin(name = "YolServisi")
public class YolServisiPlugin extends Plugin {

    static volatile YolServisiPlugin ornek;

    @Override
    public void load() {
        ornek = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (ornek == this) ornek = null;
    }

    /** Servisten çağrılır; ana iş parçacığında olmak zorunda değildir. */
    static void yay(String olay, JSObject veri) {
        YolServisiPlugin p = ornek;
        if (p != null) p.notifyListeners(olay, veri);
    }

    private boolean izinVar(String izin) {
        return ContextCompat.checkSelfPermission(getContext(), izin) == PackageManager.PERMISSION_GRANTED;
    }

    private Intent komut(String eylem) {
        return new Intent(getContext(), YolServisi.class).setAction(eylem);
    }

    @PluginMethod
    public void baslat(PluginCall call) {
        if (!izinVar(Manifest.permission.ACCESS_FINE_LOCATION)) {
            call.reject("Konum izni yok");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && !izinVar("android.permission.POST_NOTIFICATIONS") && getActivity() != null) {
            // İzin verilmezse servis yine çalışır, yalnız bildirim görünmez.
            ActivityCompat.requestPermissions(getActivity(), new String[] { "android.permission.POST_NOTIFICATIONS" }, 7123);
        }
        Intent i = komut(YolServisi.BASLAT)
            .putExtra("baslik", call.getString("baslik", "Yol Planı"))
            .putExtra("metin", call.getString("metin", "Yolculuk izleniyor"));
        try {
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Servis başlatılamadı: " + e.getMessage());
        }
    }

    @PluginMethod
    public void guncelle(PluginCall call) {
        if (!YolServisi.calisiyor) { call.resolve(); return; }
        Intent i = komut(YolServisi.GUNCELLE)
            .putExtra("baslik", call.getString("baslik", "Yol Planı"))
            .putExtra("metin", call.getString("metin", ""))
            .putExtra("gitUrl", call.getString("gitUrl", null))
            .putExtra("gitAd", call.getString("gitAd", "Yönlendir"));
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void soyle(PluginCall call) {
        if (!YolServisi.calisiyor) { call.reject("Servis çalışmıyor"); return; }
        getContext().startService(komut(YolServisi.SOYLE).putExtra("metin", call.getString("metin", "")));
        call.resolve();
    }

    @PluginMethod
    public void durdur(PluginCall call) {
        if (YolServisi.calisiyor) getContext().startService(komut(YolServisi.DURDUR));
        call.resolve();
    }

    @PluginMethod
    public void durumu(PluginCall call) {
        JSObject r = new JSObject();
        r.put("calisiyor", YolServisi.calisiyor);
        call.resolve(r);
    }
}
