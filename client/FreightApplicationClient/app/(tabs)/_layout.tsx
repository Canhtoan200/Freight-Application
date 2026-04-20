import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabsLayout() {
  const router = useRouter();

  useEffect(() => {
    checkUserPosition();
  }, []);

  const checkUserPosition = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('userToken');
      const user = jsonValue != null ? JSON.parse(jsonValue) : null;

      if (!user?.position) {
        // Nếu không có position, quay về login
        router.replace('/');
        return;
      }

      const position = user.position;

      // Dùng object mapping để kiểm tra position hợp lệ
      const routeMap: Record<string, string> = {
        'Admin': '/(admins)',
        'Accountant': '/(accountants)',
        'Partner': '/(businessPartners)',
        'Driver': '/(drivers)',
        'Guest': '/(guests)',
        'QAStaff': '/(QAStaffs)'
      };

      const route = routeMap[position];
      if (route) {
        router.replace(route as any);
      } else {
        // Position không hợp lệ, quay về login
        router.replace('/');
      }
    } catch (e) {
      console.error("Lỗi kiểm tra position:", e);
      router.replace('/');
    }
  };

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
