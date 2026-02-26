import { Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Protos Farm</Text>
      <Text>Sistema de Gerenciamento de Fazendas</Text>
    </View>
  );
}
