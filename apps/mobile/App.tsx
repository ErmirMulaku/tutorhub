import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { ClientSlot, ClientTutor } from '@ermulaku/api-client';
import { api, DEMO_EMAIL, formatTime, nextWeekday } from './src/api';

type BookState = 'idle' | 'booking' | 'booked' | 'error';

export default function App(): React.JSX.Element {
  const [tutors, setTutors] = useState<ClientTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClientTutor | null>(null);

  useEffect(() => {
    void api
      .listTutors()
      .then((page) => setTutors(page.items))
      .catch(() => setError('Could not reach the API. Is it running on :4000?'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#0e8f8a" size="large" />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (selected) {
    return <TutorDetail tutor={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Find a tutor</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={tutors}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.listPad}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <Text style={styles.name}>{item.name}</Text>
            {item.bio ? <Text style={styles.muted}>{item.bio}</Text> : null}
            <View style={styles.row}>
              <Text style={styles.price}>${(item.hourlyCents / 100).toFixed(0)}/hr</Text>
              <Text style={styles.muted}>{item.subjects.map((s) => s.name).join(' · ')}</Text>
            </View>
          </Pressable>
        )}
      />
      <StatusBar style="auto" />
    </View>
  );
}

function TutorDetail({
  tutor,
  onBack,
}: {
  tutor: ClientTutor;
  onBack: () => void;
}): React.JSX.Element {
  const date = nextWeekday();
  const [slots, setSlots] = useState<ClientSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<BookState>('idle');
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getAvailability(tutor.id, date)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [tutor.id, date]);

  const book = async (slot: ClientSlot): Promise<void> => {
    const subject = tutor.subjects[0];
    if (!subject) return;
    setState('booking');
    try {
      if (!api.isAuthenticated) await api.devLogin(DEMO_EMAIL);
      await api.bookLesson({ tutorId: tutor.id, subjectId: subject.id, startTime: slot.start });
      setBookedAt(formatTime(slot.start, tutor.timezone));
      setState('booked');
    } catch {
      setState('error');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.listPad}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← All tutors</Text>
      </Pressable>
      <Text style={styles.h1}>{tutor.name}</Text>
      <Text style={styles.muted}>{tutor.timezone}</Text>

      {state === 'booked' && bookedAt ? (
        <Text style={styles.success}>Booked! Lesson confirmed for {bookedAt}.</Text>
      ) : null}
      {state === 'error' ? <Text style={styles.error}>Could not book that slot.</Text> : null}

      <Text style={styles.h2}>Availability · {date}</Text>
      {loading ? (
        <ActivityIndicator color="#0e8f8a" />
      ) : slots.length === 0 ? (
        <Text style={styles.muted}>No slots on this day.</Text>
      ) : (
        <View style={styles.slots}>
          {slots.map((slot) => (
            <Pressable
              key={slot.start}
              style={styles.slot}
              disabled={state === 'booking'}
              onPress={() => void book(slot)}
            >
              <Text style={styles.slotText}>{formatTime(slot.start, tutor.timezone)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f1620', paddingTop: 56, paddingHorizontal: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
  listPad: { paddingBottom: 32 },
  h1: { color: '#eef3f7', fontSize: 26, fontWeight: '800', marginBottom: 12 },
  h2: { color: '#eef3f7', fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  card: {
    backgroundColor: '#16202b',
    borderColor: '#2a3947',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  name: { color: '#eef3f7', fontSize: 17, fontWeight: '700' },
  muted: { color: '#9fb0bf', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  price: { color: '#2bb6b0', fontWeight: '700', fontSize: 16 },
  back: { color: '#9fb0bf', fontWeight: '600', marginBottom: 12 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    backgroundColor: '#16202b',
    borderColor: '#2a3947',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  slotText: { color: '#eef3f7', fontWeight: '700' },
  success: { color: '#2bb6b0', fontWeight: '700', marginTop: 12 },
  error: { color: '#d64545', fontWeight: '600', marginTop: 12 },
});
