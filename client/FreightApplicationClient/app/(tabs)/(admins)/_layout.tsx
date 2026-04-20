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
          title: 'Tổng hợp kế hoạch',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart-sharp' : 'stats-chart-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="accountantDetail"
        options={{
          title: 'Kế toán',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calculator-sharp' : 'calculator-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="employeeSalary"
        options={{
          title: 'Lương nhân viên',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'wallet-sharp' : 'wallet-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="driverManagement"
        options={{
          title: 'Tài xế',
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
      <Tabs.Screen
        name="orderManagement"
        options={{
          title: 'Chi tiết đơn hàng',
          tabBarStyle: { display: 'none' },
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list-sharp' : 'list-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="createOrderManagement"
        options={{
          title: 'Tạo đơn hàng mới',
          tabBarStyle: { display: 'none' },
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list-sharp' : 'list-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="DriverMapManagement"
        options={{
          title: 'Quản lí đội xe',
          tabBarStyle: { display: 'none' },
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list-sharp' : 'list-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}
