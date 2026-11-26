# Randenblick Kamera

Web-App für Android-Chrome: Sie macht Fotos und schreibt Standort, Höhe, Blickrichtung, Neigung und Kippung in die JPEG-Datei.

- EXIF-GPS: Breite, Länge, Höhe ü. M. (LN02, genähert), `GPSHPositioningError`, `GPSImgDirection` (geografisch Nord, Missweisung +3.4°).
- `UserComment`: Neigung, Kippung, Messstreuung, ellipsoidische Höhe, LV95-Koordinaten.
- CSV mit allen Werten, auch die Blick- und Oben-Vektoren (x Ost, y Nord, z oben).
- Die Fotos bleiben auf dem Handy (Downloads bzw. Teilen). Die Seite sendet nichts an einen Server.

Neigung: 0° = waagrecht, −90° = senkrecht nach unten. Kippung: + = rechte Bildseite tiefer.

## Raumliste («Was fehlt»)

- Die Liste der Räume und Motive steht **nicht** in diesem Repo. Sie kommt gepackt im Link-Anhang `#liste=…` (JSON, deflate-raw, base64url).
- Den Teil nach `#` schickt der Browser nie an einen Server. Die App liest ihn einmal, speichert die Liste nur auf dem Handy (localStorage) und entfernt ihn aus der Adresszeile.
- In der App: Leiste über dem Auslöser antippen → Raum und Motiv wählen. Jedes Foto zählt mit; ist ein Motiv voll, springt die App zum nächsten offenen Motiv. «−» nimmt einen Zähler zurück.
- Raum und Motiv kommen ins Foto: Dateiname `RB_<raum>-<motiv>_…`, `ImageDescription` (ASCII), `XPTitle`/`XPComment` (Unicode) und `UserComment` (`raum=…; motiv=…; foto=i/n`).
- Neue CSV-Spalten vorne: `raum_id`, `raum`, `stockwerk`, `motiv_nr`, `motiv`, `motiv_foto`.
