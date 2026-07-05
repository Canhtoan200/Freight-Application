import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}`
  : '';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';

const loadMapLibre = async () => {
  if (typeof window === 'undefined') return null;
  const existing = (window as any).maplibregl;
  if (existing) return existing;

  const css = document.querySelector(`link[href="${MAPLIBRE_CSS}"]`) as HTMLLinkElement | null;
  if (!css) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${MAPLIBRE_JS}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve((window as any).maplibregl);
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Không tải được thư viện MapLibre.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => {
      if ((window as any).maplibregl) {
        resolve((window as any).maplibregl);
      } else {
        reject(new Error('MapLibre không được định nghĩa sau khi nạp script.'));
      }
    };
    script.onerror = () => reject(new Error('Không tải được thư viện MapLibre.'));
    document.body.appendChild(script);
  });
};

export default function DriverMapManagement() {
  const mapContainerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let map: any;
    let mounted = true;

    if (!GOONG_STYLE_URL) {
      setLoading(false);
      return;
    }

    const init = async () => {
      if (!mapContainerRef.current) {
        return;
      }

      try {
        const maplibregl = await loadMapLibre();
        if (!mounted || !mapContainerRef.current) return;
        if (!maplibregl || !maplibregl.Map) {
          throw new Error('MapLibre không hợp lệ.');
        }

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: GOONG_STYLE_URL,
          center: [105.83416, 21.02776],
          zoom: 12,
        });

        map.on('error', (event: any) => {
          console.error('MapLibre error:', event);
          if (mounted) {
            setErrorMessage('Lỗi khi tải dữ liệu bản đồ.');
          }
        });

              map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

        new maplibregl.Marker({ color: '#2563eb' })
          .setLngLat([105.83416, 21.02776])
          .addTo(map);

        const loadTimeout = window.setTimeout(() => {
          if (mounted) {
            setLoading(false);
          }
        }, 5000);

        map.on('load', () => {
          if (mounted) {
            setErrorMessage('');
            setLoading(false);
          }
          window.clearTimeout(loadTimeout);
        });
      } catch (error: any) {
        console.error(error);
        if (mounted) {
          setErrorMessage(error.message || 'Không thể khởi tạo bản đồ web.');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (map) {
        map.remove();
      }
    };
  }, [GOONG_STYLE_URL]);

  if (!GOONG_MAPTILES_KEY) {
    return (
      <View style={styles.container}>
        <View style={styles.mapCard}>
          <View style={styles.placeholder}>
            <Text style={styles.title}>Bản đồ web chưa sẵn sàng</Text>
            <Text style={styles.text}>Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY trong file .env.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapCard}>
        <View ref={mapContainerRef} style={styles.map} />
        {loading && (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Đang tải bản đồ...</Text>
            <Text style={styles.text}>Vui lòng đợi trong giây lát.</Text>
          </View>
        )}
        {errorMessage ? (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Lỗi bản đồ web</Text>
            <Text style={styles.text}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef6ff',
    padding: 16,
  },
  mapCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  map: {
    flex: 1,
    minHeight: 320,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  caption: {
    color: '#64748b',
    fontSize: 12,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  text: {
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  marker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#fff',
  },
  overlayPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
});
