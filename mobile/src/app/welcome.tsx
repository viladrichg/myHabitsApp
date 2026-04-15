import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { User, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { createUser } from '@/lib/database/db';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();
  const [name, setName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    // Validate name
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      setError('Please enter your name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await createUser(trimmedName);
      if (user) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Navigate to home screen
        router.replace('/');
      } else {
        setError('Failed to create profile. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setError('An error occurred. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 px-6"
          >
            {/* Header */}
            <View className="pt-16 pb-8">
              <View className="w-20 h-20 bg-blue-500/20 rounded-full items-center justify-center self-center mb-6">
                <User size={40} color="#3b82f6" />
              </View>
              <Text className="text-3xl font-bold text-white text-center mb-3">
                Welcome to Daily Tracker
              </Text>
              <Text className="text-base text-slate-300 text-center leading-6">
                Your personal life companion for tracking daily activities, sleep, and more.
              </Text>
            </View>

            {/* Form */}
            <View className="flex-1 justify-center">
              <View className="bg-slate-800/50 rounded-2xl p-6 mb-6">
                <Text className="text-lg font-semibold text-white mb-2">
                  What's your name?
                </Text>
                <Text className="text-sm text-slate-400 mb-4">
                  This will be used to personalize your experience. All data will be linked to this profile.
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    setError(null);
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  editable={!isLoading}
                  className="bg-slate-900 rounded-xl px-4 py-4 text-white text-lg"
                />
                {error && (
                  <Text className="text-red-400 text-sm mt-2">{error}</Text>
                )}
              </View>

              {/* Info card */}
              <View className="bg-slate-800/30 rounded-xl p-4 mb-8">
                <Text className="text-xs text-slate-400 leading-5">
                  Your data is stored 100% offline on your device. No internet connection required. You can export and import your data anytime from Settings.
                </Text>
              </View>
            </View>

            {/* Continue Button */}
            <View className="pb-8">
              <Pressable
                onPress={handleContinue}
                disabled={isLoading}
                className="active:opacity-80"
              >
                <LinearGradient
                  colors={isLoading ? ['#475569', '#334155'] : ['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text className="text-white text-lg font-bold mr-2">
                    {isLoading ? 'Creating Profile...' : 'Continue'}
                  </Text>
                  {!isLoading && <ChevronRight size={24} color="#ffffff" />}
                </LinearGradient>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
