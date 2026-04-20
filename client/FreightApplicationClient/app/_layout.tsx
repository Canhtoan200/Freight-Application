import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useSegments, Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkLoginStatus();
    }, [])
  );

  const checkLoginStatus = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('userToken');
      const user = jsonValue != null ? JSON.parse(jsonValue) : null;
      const loggedIn = !!user?.position;
      setIsLoggedIn(loggedIn);

      // Nếu không còn đăng nhập, điều hướng về login
      if (!loggedIn && isLoggedIn) {
        // Chuyển về trang login nếu đã logout
        router.replace('/');
      }
    } catch (e) {
      console.error("Lỗi kiểm tra trạng thái:", e);
      setIsLoggedIn(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack 
        screenOptions={{ headerShown: false }}
        initialRouteName={isLoggedIn ? '(tabs)' : 'index'}
      >
        <Stack.Screen 
          name="index" 
          options={{ title: '/login' }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ title: '' }} 
        />
        <Stack.Screen name="[...unmatched]" options={{ title: '' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
