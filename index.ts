import 'expo-router/entry';

import { registerWidget } from '@/widget';

// Android home-screen widget (a no-op in Expo Go, which lacks the native module).
registerWidget();
