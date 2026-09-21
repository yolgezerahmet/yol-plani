package app.yolplani.servis;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Ön plan servisi. Google Haritalar öndeyken ya da ekran kilitliyken:
 *  - konumu (GPS) JS'e iletir,
 *  - 5 sn'de bir "tik" yayar: JS'teki OBD okuması ve karar hesabı buna bağlıdır, tarayıcı
 *    zamanlayıcılarının arka planda kısılmasından etkilenmez,
 *  - sesli uyarıyı Android'in metin okumasıyla, navigasyon sesini kısarak verir,
 *  - canlı bildirimi günceller ("Yeniden planla", "Durağa git").
 * Bekçi: JS 45 sn boyunca bildirimi güncellemezse bildirim bunu söyler; arka plan davranışı
 * cihazda böyle doğrulanır.
 */
public class YolServisi extends Service implements LocationListener, TextToSpeech.OnInitListener {

    static final String BASLAT = "app.yolplani.servis.BASLAT";
    static final String GUNCELLE = "app.yolplani.servis.GUNCELLE";
    static final String SOYLE = "app.yolplani.servis.SOYLE";
    static final String DURDUR = "app.yolplani.servis.DURDUR";
    static final String EYLEM_YENIDEN = "app.yolplani.servis.YENIDEN";

    static volatile boolean calisiyor = false;

    private static final String KANAL = "yol-plani-yolda";
    private static final int NO = 4711;
    private static final long TIK_MS = 5000, BEKCI_MS = 45000;

    private final Handler ana = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock kilit;
    private LocationManager konum;
    private TextToSpeech tts;
    private boolean ttsHazir = false;
    private final List<String> bekleyenSes = new ArrayList<>();
    private AudioManager ses;
    private AudioFocusRequest odak;

    private String baslik = "Yol Planı", metin = "Yolculuk izleniyor", gitUrl = null, gitAd = "Yönlendir";
    private long sonGuncelleme = 0;
    private boolean bekciUyardi = false;

    private final Runnable tik = new Runnable() {
        @Override public void run() {
            if (!calisiyor) return;
            JSObject v = new JSObject();
            v.put("t", System.currentTimeMillis());
            YolServisiPlugin.yay("tik", v);
            long simdi = System.currentTimeMillis();
            if (!bekciUyardi && sonGuncelleme > 0 && simdi - sonGuncelleme > BEKCI_MS) {
                bekciUyardi = true;
                bildir("Yol Planı yanıt vermiyor", "Arka planda durduruldu olabilir. Açmak için dokun.");
            }
            ana.postDelayed(this, TIK_MS);
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String eylem = intent != null ? intent.getAction() : null;
        if (eylem == null) return START_NOT_STICKY;
        switch (eylem) {
            case BASLAT:
                baslik = metinAl(intent, "baslik", baslik);
                metin = metinAl(intent, "metin", metin);
                basla();
                break;
            case GUNCELLE:
                baslik = metinAl(intent, "baslik", baslik);
                metin = metinAl(intent, "metin", metin);
                gitUrl = intent.getStringExtra("gitUrl");
                gitAd = metinAl(intent, "gitAd", gitAd);
                sonGuncelleme = System.currentTimeMillis();
                bekciUyardi = false;
                bildir(baslik, metin);
                break;
            case SOYLE:
                konus(intent.getStringExtra("metin"));
                break;
            case EYLEM_YENIDEN:
                JSObject v = new JSObject();
                v.put("ad", "yeniden");
                YolServisiPlugin.yay("eylem", v);
                break;
            case DURDUR:
                bitir();
                break;
        }
        return START_NOT_STICKY;
    }

    private static String metinAl(Intent i, String ad, String varsayilan) {
        String s = i.getStringExtra(ad);
        return s != null ? s : varsayilan;
    }

    private boolean izinVar(String izin) {
        return ContextCompat.checkSelfPermission(this, izin) == PackageManager.PERMISSION_GRANTED;
    }

    private void basla() {
        kanalKur();
        int tur = 0;
        if (Build.VERSION.SDK_INT >= 29) {
            if (izinVar(Manifest.permission.ACCESS_FINE_LOCATION)) tur |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
            boolean bt = Build.VERSION.SDK_INT < 31 || izinVar("android.permission.BLUETOOTH_CONNECT");
            if (bt) tur |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
        }
        try {
            ServiceCompat.startForeground(this, NO, bildirimYap(baslik, metin), tur);
        } catch (Exception e) {
            stopSelf();
            return;
        }
        if (calisiyor) return;           // ikinci başlatma: yalnız bildirim tazelendi
        calisiyor = true;
        sonGuncelleme = System.currentTimeMillis();

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            kilit = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "yolplani:yolda");
            kilit.acquire(10 * 60 * 60 * 1000L);   // en çok 10 saat
        }
        konum = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            if (konum != null) konum.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0f, this, Looper.getMainLooper());
        } catch (SecurityException | IllegalArgumentException e) {
            JSObject v = new JSObject();
            v.put("hata", "Konum alınamıyor: " + e.getMessage());
            YolServisiPlugin.yay("hata", v);
        }
        ses = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        tts = new TextToSpeech(this, this);
        ana.postDelayed(tik, TIK_MS);
    }

    private void bitir() {
        calisiyor = false;
        ana.removeCallbacks(tik);
        if (konum != null) { try { konum.removeUpdates(this); } catch (Exception ignored) { } }
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; ttsHazir = false; }
        odakBirak();
        if (kilit != null && kilit.isHeld()) kilit.release();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (calisiyor) bitir();
        super.onDestroy();
    }

    // ---- Bildirim ---------------------------------------------------------------------------
    private void kanalKur() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(KANAL) != null) return;
        NotificationChannel k = new NotificationChannel(KANAL, "Yolda takip", NotificationManager.IMPORTANCE_LOW);
        k.setDescription("Sıradaki şarj durağı ve batarya durumu");
        k.setShowBadge(false);
        nm.createNotificationChannel(k);
    }

    private Notification bildirimYap(String b, String m) {
        int bayrak = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent ac = getPackageManager().getLaunchIntentForPackage(getPackageName());
        NotificationCompat.Builder y = new NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle(b)
            .setContentText(m)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(m))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (ac != null) {
            ac.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            y.setContentIntent(PendingIntent.getActivity(this, 1, ac, bayrak));
        }
        Intent yeniden = new Intent(this, YolServisi.class).setAction(EYLEM_YENIDEN);
        y.addAction(0, "Yeniden planla", PendingIntent.getService(this, 2, yeniden, bayrak));
        if (gitUrl != null) {
            Intent git = new Intent(Intent.ACTION_VIEW, Uri.parse(gitUrl)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            y.addAction(0, gitAd, PendingIntent.getActivity(this, 3, git, bayrak));
        }
        return y.build();
    }

    private void bildir(String b, String m) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && calisiyor) nm.notify(NO, bildirimYap(b, m));
    }

    // ---- Konum ------------------------------------------------------------------------------
    @Override
    public void onLocationChanged(Location l) {
        JSObject v = new JSObject();
        v.put("enlem", l.getLatitude());
        v.put("boylam", l.getLongitude());
        v.put("dogruluk", l.hasAccuracy() ? l.getAccuracy() : 999);
        v.put("hiz", l.hasSpeed() ? l.getSpeed() : -1);
        v.put("t", l.getTime());
        YolServisiPlugin.yay("konum", v);
    }
    // API 29 altında bunlar soyut; açıkça yazılmazsa eski cihazda çöker.
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onProviderDisabled(String provider) { }

    // ---- Ses --------------------------------------------------------------------------------
    @Override
    public void onInit(int durum) {
        if (durum != TextToSpeech.SUCCESS || tts == null) return;
        int dil = tts.setLanguage(new Locale("tr", "TR"));
        ttsHazir = dil != TextToSpeech.LANG_MISSING_DATA && dil != TextToSpeech.LANG_NOT_SUPPORTED;
        if (!ttsHazir) {
            JSObject v = new JSObject();
            v.put("hata", "Türkçe ses paketi yok; Ayarlar > Metin okuma çıkışı'ndan yükleyin.");
            YolServisiPlugin.yay("hata", v);
            return;
        }
        tts.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { if (tts != null && !tts.isSpeaking()) odakBirak(); }
            @Override public void onError(String id) { odakBirak(); }
        });
        for (String s : bekleyenSes) konus(s);
        bekleyenSes.clear();
    }

    private void konus(String s) {
        if (s == null || s.isEmpty()) return;
        if (!ttsHazir || tts == null) { bekleyenSes.add(s); return; }
        odakAl();
        tts.speak(s, TextToSpeech.QUEUE_ADD, null, "yp-" + System.nanoTime());
    }

    // Navigasyonun sesi susturulmaz, kısılır: sürücü iki uyarıyı da duyar.
    private void odakAl() {
        if (ses == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            odak = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .build();
            ses.requestAudioFocus(odak);
        } else {
            ses.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
    }

    private void odakBirak() {
        if (ses == null) return;
        if (Build.VERSION.SDK_INT >= 26) { if (odak != null) ses.abandonAudioFocusRequest(odak); }
        else ses.abandonAudioFocus(null);
    }
}
