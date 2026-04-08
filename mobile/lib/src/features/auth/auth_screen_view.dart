import 'package:flutter/material.dart';

import '../../core/session/app_controller.dart';

class AuthScreenView extends StatefulWidget {
  const AuthScreenView({super.key, required this.controller});

  final AppController controller;

  @override
  State<AuthScreenView> createState() => _AuthScreenViewState();
}

class _AuthScreenViewState extends State<AuthScreenView> {
  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();
  final _registerNameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  late final Future<Map<String, dynamic>> _methodsFuture = widget.controller.api.getAuthMethods();

  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _registerNameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    setState(() {
      _error = null;
      _isSubmitting = true;
    });
    try {
      await widget.controller.login(
        email: _loginEmailController.text.trim(),
        password: _loginPasswordController.text,
      );
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _submitRegister() async {
    setState(() {
      _error = null;
      _isSubmitting = true;
    });
    try {
      await widget.controller.register(
        name: _registerNameController.text.trim(),
        email: _registerEmailController.text.trim(),
        password: _registerPasswordController.text,
      );
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              scheme.primaryContainer.withValues(alpha: 0.9),
              scheme.surface,
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Card(
                  elevation: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _Header(methodsFuture: _methodsFuture),
                        const SizedBox(height: 24),
                        if (_error != null) ...[
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: scheme.errorContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Text(
                                _error!,
                                style: TextStyle(color: scheme.onErrorContainer),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        DefaultTabController(
                          length: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const TabBar(
                                tabs: [
                                  Tab(text: 'ログイン'),
                                  Tab(text: '新規登録'),
                                ],
                              ),
                              SizedBox(
                                height: 350,
                                child: TabBarView(
                                  children: [
                                    _LoginForm(
                                      emailController: _loginEmailController,
                                      passwordController: _loginPasswordController,
                                      isSubmitting: _isSubmitting,
                                      onSubmit: _submitLogin,
                                    ),
                                    _RegisterForm(
                                      nameController: _registerNameController,
                                      emailController: _registerEmailController,
                                      passwordController: _registerPasswordController,
                                      isSubmitting: _isSubmitting,
                                      onSubmit: _submitRegister,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.methodsFuture});

  final Future<Map<String, dynamic>> methodsFuture;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder<Map<String, dynamic>>(
      future: methodsFuture,
      builder: (context, snapshot) {
        final methods = snapshot.data ?? const <String, dynamic>{};
        final localEnabled = methods['local'] != false;
        final authMode = methods['authMode'] as String? ?? 'local';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hono Health',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Web と同じ健康記録 API に接続します。',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Chip(
                  avatar: Icon(
                    localEnabled ? Icons.lock_open_rounded : Icons.lock_rounded,
                    size: 18,
                    color: localEnabled ? scheme.primary : scheme.onSurfaceVariant,
                  ),
                  label: Text(localEnabled ? 'ローカル認証' : 'ローカル認証無効'),
                ),
                Chip(label: Text('auth mode: $authMode')),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Chip(label: Text('認証方式を確認中')),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'ログイン後はダッシュボード、記録の新規入力・編集、リマインド設定、エクスポートを利用できます。',
            ),
          ],
        );
      },
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.emailController,
    required this.passwordController,
    required this.isSubmitting,
    required this.onSubmit,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 20),
      children: [
        TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'メールアドレス',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passwordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'パスワード',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: isSubmitting ? null : onSubmit,
          child: Text(isSubmitting ? 'ログイン中…' : 'ログイン'),
        ),
      ],
    );
  }
}

class _RegisterForm extends StatelessWidget {
  const _RegisterForm({
    required this.nameController,
    required this.emailController,
    required this.passwordController,
    required this.isSubmitting,
    required this.onSubmit,
  });

  final TextEditingController nameController;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 20),
      children: [
        TextField(
          controller: nameController,
          decoration: const InputDecoration(
            labelText: '表示名',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'メールアドレス',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passwordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'パスワード',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.tonal(
          onPressed: isSubmitting ? null : onSubmit,
          child: Text(isSubmitting ? '登録中…' : '新規登録'),
        ),
      ],
    );
  }
}
