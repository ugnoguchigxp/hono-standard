class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.email,
  });

  final String accessToken;
  final String refreshToken;
  final String userId;
  final String email;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      userId: (json['user'] as Map<String, dynamic>? ?? const {})['id']
              as String? ??
          '',
      email: (json['user'] as Map<String, dynamic>? ?? const {})['email']
              as String? ??
          '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'user': {'id': userId, 'email': email},
    };
  }

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    String? userId,
    String? email,
  }) {
    return AuthSession(
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      userId: userId ?? this.userId,
      email: email ?? this.email,
    );
  }
}
