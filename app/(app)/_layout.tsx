import { AppDataBootstrap } from "@/components/AppDataBootstrap";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function AppTabsLayout() {
  return (
    <>
      <AppDataBootstrap />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#4f63ff",
          tabBarInactiveTintColor: "#9ca3af",
          tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: "Rewards",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="sparkles-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="todo"
          options={{
            title: "To-Do List",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="add-task"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}
