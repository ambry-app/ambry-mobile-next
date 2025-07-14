import { Stack } from "expo-router";

export default function ShelfStackLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "My Shelf",
        }}
      />
      <Stack.Screen
        name="in-progress"
        options={{
          title: "In Progress",
        }}
      />
    </Stack>
  );
}
