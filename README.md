# Randenblick Kamera

Web-App für Android-Chrome: Sie macht Fotos und schreibt Standort, Höhe, Blickrichtung, Neigung und Kippung in die JPEG-Datei.

- EXIF-GPS: Breite, Länge, Höhe ü. M. (LN02, genähert), `GPSHPositioningError`, `GPSImgDirection` (geografisch Nord, Missweisung +3.4°).
- `UserComment`: Neigung, Kippung, Messstreuung, ellipsoidische Höhe, LV95-Koordinaten.
- CSV mit allen Werten, auch die Blick- und Oben-Vektoren (x Ost, y Nord, z oben).
- Die Fotos bleiben auf dem Handy (Downloads bzw. Teilen). Die Seite sendet nichts an einen Server.

Neigung: 0° = waagrecht, −90° = senkrecht nach unten. Kippung: + = rechte Bildseite tiefer.
