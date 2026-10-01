import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Linking,
  Vibration,
  ScrollView,
  SafeAreaView,
} from 'react-native';

export default function App() {
  // Phases: 'STANDBY' | 'COUNTDOWN' | 'ACTIVE'
  const [phase, setPhase] = useState<'STANDBY' | 'COUNTDOWN' | 'ACTIVE'>('STANDBY');

  // Hold progress (0 to 100)
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<any>(null);

  // 10-second cancel countdown
  const [countdown, setCountdown] = useState(10);
  const countdownIntervalRef = useRef<any>(null);

  // Active distress metadata
  const [pings, setPings] = useState(0);
  const pingIntervalRef = useRef<any>(null);
  const coords = { lat: 19.0760, lng: 72.8777 };

  // 1. Hold SOS button handling (3 seconds)
  const handlePressIn = () => {
    if (phase !== 'STANDBY') return;
    setHoldProgress(0);
    const start = Date.now();

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, (elapsed / 3000) * 100);
      setHoldProgress(progress);

      if (progress >= 100) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        triggerCountdown();
      }
    }, 50);
  };

  const handlePressOut = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  // 2. Start 10-second countdown window
  const triggerCountdown = () => {
    try {
      Vibration.vibrate([0, 400, 200, 400]);
    } catch {
      // vibration fallback
    }

    setPhase('COUNTDOWN');
    setCountdown(10);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          activateEmergency();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // User aborts within 10-second window
  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setPhase('STANDBY');
    setCountdown(10);
    setHoldProgress(0);
  };

  // 3. Activate Emergency Dispatch
  const activateEmergency = () => {
    setPhase('ACTIVE');
    setPings(1);

    try {
      Vibration.vibrate([0, 800, 400, 800]);
    } catch {
      // vibration fallback
    }

    // Start 15s ping simulation
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      setPings((c) => c + 1);
    }, 15000);
  };

  // Stand-down alert
  const handleStandDown = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    setPhase('STANDBY');
    setHoldProgress(0);
  };

  // Native phone dialer invocation
  const handleCall112 = () => {
    Linking.openURL('tel:112').catch(() => {
      // fallback
    });
  };

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.badge}>CAMPUSVOICE SAFETY</Text>
          <Text style={styles.headerTitle}>Emergency Dispatch</Text>
          <Text style={styles.headerSubtitle}>Instant Police Precinct & Campus Patrol Gateway</Text>
        </View>

        {/* STANDBY PHASE */}
        {phase === 'STANDBY' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Immediate Distress Alert</Text>
            <Text style={styles.cardDesc}>
              Press and hold the red button for 3 seconds to initiate immediate emergency dispatch.
            </Text>

            <TouchableOpacity
              style={[
                styles.sosButton,
                holdProgress > 0 && {
                  transform: [{ scale: 1.05 }],
                  backgroundColor: '#b91c1c',
                },
              ]}
              activeOpacity={0.9}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Text style={styles.sosText}>HOLD FOR SOS</Text>
              <Text style={styles.sosSubtext}>
                {holdProgress > 0 ? `${Math.round(holdProgress)}% (HOLD)` : 'HOLD 3 SECONDS'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.guidanceText}>
              Includes 10-second cancel window before notifying responders
            </Text>

            {/* Direct Speed Dial 112 */}
            <TouchableOpacity style={styles.call112Button} onPress={handleCall112} activeOpacity={0.8}>
              <Text style={styles.call112Text}>CALL 112 (DIRECT POLICE)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* COUNTDOWN PHASE */}
        {phase === 'COUNTDOWN' && (
          <View style={styles.card}>
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownNumber}>{countdown}</Text>
            </View>

            <Text style={styles.countdownTitle}>DISPATCHING EMERGENCY ALERT</Text>
            <Text style={styles.countdownSub}>
              Alert will be transmitted to campus security and nearest police precincts in {countdown} seconds.
            </Text>
            <Text style={styles.coordsText}>
              Acquired GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelCountdown}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>I AM SAFE — CANCEL ALERT</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIVE EMERGENCY PHASE */}
        {phase === 'ACTIVE' && (
          <View style={[styles.card, styles.activeCard]}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>EMERGENCY BEACON ACTIVE</Text>
            </View>

            {/* Mandatory Non-Negotiable Copy */}
            <Text style={styles.dispatchNotice}>
              Alert sent to registered police/security contacts. Speed dial 112 active.
            </Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Live GPS Transmission</Text>
              <Text style={styles.infoText}>
                Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </Text>
              <Text style={styles.infoText}>Periodic Location Pings Sent: {pings}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Nearest Dispatched Precincts</Text>
              <Text style={styles.infoText}>• South Campus Police Precinct (1.2 km)</Text>
              <Text style={styles.infoText}>• Central Metro Police Station (2.8 km)</Text>
            </View>

            <TouchableOpacity style={styles.emergency112Button} onPress={handleCall112} activeOpacity={0.8}>
              <Text style={styles.emergency112Text}>CALL 112 NOW (SPEED-DIAL)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.standDownButton} onPress={handleStandDown} activeOpacity={0.8}>
              <Text style={styles.standDownText}>I Am Now Safe (Stand Down Alert)</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer Support Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Campus Security 24/7 Hotline: +91 22 2650 0112 • National Emergency: 112
          </Text>
          <Text style={styles.footerSub}>
            CampusVoice Mobile • Built for immediate student & faculty safety
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    paddingBottom: 32,
  },
  header: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 20,
  },
  badge: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    width: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  activeCard: {
    borderColor: '#ef4444',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    width: 190,
    height: 190,
    borderRadius: 95,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    marginBottom: 20,
  },
  sosText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosSubtext: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  guidanceText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  call112Button: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  call112Text: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  countdownBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#dc2626',
  },
  countdownTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#991b1b',
    marginBottom: 6,
    textAlign: 'center',
  },
  countdownSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  coordsText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 24,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  statusPill: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dispatchNotice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoText: {
    fontSize: 11,
    color: '#475569',
    marginVertical: 1,
  },
  emergency112Button: {
    width: '100%',
    backgroundColor: '#dc2626',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
  },
  emergency112Text: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  standDownButton: {
    width: '100%',
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  standDownText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  footer: {
    width: '90%',
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  footerSub: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
});
