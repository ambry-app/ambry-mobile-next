import { Stack } from "expo-router";

const getId = ({ params }: { params?: Record<string, any> | undefined }) =>
  params?.id;

export default function LibraryStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Library" }} />
      <Stack.Screen name="media/[id]" getId={getId} />
      <Stack.Screen name="person/[id]" getId={getId} />
      <Stack.Screen name="series/[id]" getId={getId} />
      <Stack.Screen name="book/[id]" getId={getId} />
    </Stack>
  );
}
