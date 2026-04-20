import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      {/* Stack.Screen giúp thay đổi tiêu đề trên thanh điều hướng */}
      <Stack.Screen options={{ title: 'Ối! Không tìm thấy trang' }} />
      
      <View style={styles.container}>
        <Text style={styles.title}>Trang này không tồn tại.</Text>
        
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Quay lại màn hình chính!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 20,
  },
  linkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
});
