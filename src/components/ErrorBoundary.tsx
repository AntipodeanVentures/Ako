import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { reportCrash, sendReport } from '@/src/features/reporting';

// Catches a render error anywhere below it, reports it, and shows a plain
// screen with a reload and a box to say what the learner was doing. Styled
// with fixed values rather than the theme, so it still draws if the theme
// or the font is what failed.

type State = { error: Error | null; note: string; sent: boolean; sending: boolean };

const ink = '#17191D';
const muted = '#6B6F76';
const border = '#E6E7EA';

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, note: '', sent: false, sending: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportCrash(error.message || String(error), { stack: (error.stack || '').slice(0, 4000), componentStack: (info.componentStack || '').slice(0, 2000) });
  }

  reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
      return;
    }
    this.setState({ error: null, note: '', sent: false, sending: false });
  };

  send = async () => {
    const note = this.state.note.trim();
    if (!note) return;
    this.setState({ sending: true });
    try {
      await sendReport('problem', note, { afterCrash: this.state.error?.message ?? '' });
      this.setState({ sent: true, sending: false });
    } catch {
      this.setState({ sending: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: '600', color: ink, letterSpacing: -0.5 }}>Something went wrong</Text>
          <Text style={{ fontSize: 16, lineHeight: 23, color: muted }}>
            A report has been sent automatically, with what the app was doing. Your progress is saved at the end of each session, so at most the last few minutes are affected.
          </Text>
          <Pressable
            onPress={this.reload}
            accessibilityRole="button"
            style={{ backgroundColor: ink, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Reload</Text>
          </Pressable>
          {this.state.sent ? (
            <Text style={{ fontSize: 13, color: muted }}>Thank you. Your note is with the report.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, color: muted }}>What were you doing? Optional, but it helps.</Text>
              <TextInput
                value={this.state.note}
                onChangeText={(note) => this.setState({ note })}
                placeholder="For example: I had just answered the second practice question"
                placeholderTextColor="#9A9EA6"
                multiline
                style={{ minHeight: 72, borderWidth: 1, borderColor: border, borderRadius: 12, padding: 12, fontSize: 16, color: ink, textAlignVertical: 'top' }}
              />
              <Pressable
                onPress={this.send}
                disabled={!this.state.note.trim() || this.state.sending}
                accessibilityRole="button"
                style={{ borderWidth: 1, borderColor: border, borderRadius: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: !this.state.note.trim() || this.state.sending ? 0.5 : 1 }}
              >
                <Text style={{ color: ink, fontSize: 16, fontWeight: '600' }}>{this.state.sending ? 'Sending' : 'Send the note'}</Text>
              </Pressable>
            </View>
          )}
          <Text style={{ fontSize: 12, color: muted }} selectable>
            {this.state.error.message}
          </Text>
        </View>
      </ScrollView>
    );
  }
}
