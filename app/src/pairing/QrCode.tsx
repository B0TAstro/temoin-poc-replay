import createQrCode from 'qrcode-generator';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Draws a QR code with plain views: no native SVG module needed. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const rows = useMemo(() => {
    const qr = createQrCode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    return Array.from({ length: count }, (_, r) => Array.from({ length: count }, (_, c) => qr.isDark(r, c)));
  }, [value]);

  // Quiet zone of 2 modules around the code, as scanners expect.
  const cell = size / (rows.length + 4);
  return (
    <View style={[styles.frame, { width: size, height: size, padding: cell * 2 }]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cell, height: cell, backgroundColor: dark ? '#000' : '#fff' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#fff' },
  row: { flexDirection: 'row' },
});
