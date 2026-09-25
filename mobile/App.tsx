import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const DEFAULT_URL = 'https://rated-aronvasolli12-6438.vercel.app';

function resolveRatedUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.ratedUrl;
  const fromEnv = process.env.EXPO_PUBLIC_RATED_URL;
  const raw = (fromEnv || fromExtra || DEFAULT_URL).trim();
  return raw.replace(/\/$/, '') || DEFAULT_URL;
}

export default function App() {
  const uri = resolveRatedUrl();
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const onShouldStart = useCallback(
    (request: { url: string; navigationType?: string }) => {
      const url = request.url;
      if (!url || url === 'about:blank') return true;

      const isHttp = url.startsWith('http://') || url.startsWith('https://');
      if (!isHttp) {
        Linking.openURL(url).catch(() => {});
        return false;
      }

      try {
        const target = new URL(url);
        const home = new URL(uri);
        const sameHost = target.hostname === home.hostname;
        // Keep same-origin navigations in the WebView; open other hosts externally
        // (mailto/tel already handled above). target=_blank still hits this path.
        if (!sameHost) {
          Linking.openURL(url).catch(() => {});
          return false;
        }
      } catch {
        return true;
      }
      return true;
    },
    [uri]
  );

  const retry = useCallback(() => {
    setFailed(false);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        {failed ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>RATED is offline</Text>
            <Text style={styles.errorBody}>
              Couldn't load the site. Check your connection and try again.
            </Text>
            <Pressable
              onPress={retry}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading RATED"
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.webWrap}>
            <WebView
              key={reloadKey}
              ref={webRef}
              source={{ uri }}
              style={styles.webview}
              onNavigationStateChange={onNavChange}
              onShouldStartLoadWithRequest={onShouldStart}
              onLoadStart={() => {
                setLoading(true);
                setFailed(false);
              }}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
              onHttpError={(e) => {
                if (e.nativeEvent.statusCode >= 500) {
                  setLoading(false);
                  setFailed(true);
                }
              }}
              allowsBackForwardNavigationGestures
              setSupportMultipleWindows
              onOpenWindow={(e) => {
                const targetUrl = e.nativeEvent.targetUrl;
                if (!targetUrl) return;
                try {
                  const target = new URL(targetUrl);
                  const home = new URL(uri);
                  if (target.hostname === home.hostname) {
                    webRef.current?.injectJavaScript(
                      `window.location.href = ${JSON.stringify(targetUrl)}; true;`
                    );
                  } else {
                    Linking.openURL(targetUrl).catch(() => {});
                  }
                } catch {
                  Linking.openURL(targetUrl).catch(() => {});
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              startInLoadingState={false}
            />
            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#080808',
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#080808',
  },
  webview: {
    flex: 1,
    backgroundColor: '#080808',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080808',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#080808',
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  errorBody: {
    color: '#a3a3a3',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  retryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
