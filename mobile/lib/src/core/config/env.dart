/// `--dart-define=API_BASE_URL=http://localhost:5173` などで上書き。
/// Android エミュレータからホストの Vite: `http://10.0.2.2:5173`
class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5173',
  );

  /// `dart-define=USE_MOCK=true` でモック API に切り替え（開発用）
  static const bool useMock =
      bool.fromEnvironment('USE_MOCK', defaultValue: false);
}
