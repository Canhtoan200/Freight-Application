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
          title: 'Đơn hàng',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="driverDetail"
        options={{
          title: 'Tài xế',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-sharp' : 'person-outline'} color={color} size={24} />
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
      <Tabs.Screen
        name="createOrder"
        options={{
          tabBarStyle: { display: 'none' },
          href: null,
          title: 'Tạo đơn hàng',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle-sharp' : 'add-circle-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="orderDetail"
        options={{
          tabBarStyle: { display: 'none' },
          href: null,
          title: 'Chi tiết đơn hàng',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle-sharp' : 'add-circle-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
