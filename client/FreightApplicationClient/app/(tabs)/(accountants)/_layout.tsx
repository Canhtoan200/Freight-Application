import { Tabs } from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: {
          backgroundColor: '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#25292e',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tổng hợp nhật kí',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="liability"
        options={{
          title: 'Công nợ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cash-sharp' : 'cash-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="driverManagement"
        options={{
          title: 'Quản lý tài xế',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'car-sharp' : 'car-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: 'Cài đặt',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings-sharp' : 'settings-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
