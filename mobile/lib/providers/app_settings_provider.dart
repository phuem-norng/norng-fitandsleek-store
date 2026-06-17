import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/local_store_keys.dart';

class AppSettingsProvider extends ChangeNotifier {
  AppSettingsProvider(this._prefs);

  final SharedPreferences _prefs;

  String _language = 'en';
  ThemeMode _themeMode = ThemeMode.light;
  bool _booted = false;

  bool get booted => _booted;
  String get language => _language;
  ThemeMode get themeMode => _themeMode;
  bool get isKhmer => _language == 'km';
  bool get isDark => _themeMode == ThemeMode.dark;

  Future<void> bootstrap() async {
    _language = _prefs.getString(LocalStoreKeys.language) ?? 'en';
    final storedTheme = _prefs.getString(LocalStoreKeys.storefrontTheme) ?? 'light';
    _themeMode = storedTheme == 'dark' ? ThemeMode.dark : ThemeMode.light;
    _booted = true;
    notifyListeners();
  }

  Future<void> setLanguage(String code) async {
    if (code != 'en' && code != 'km') return;
    if (_language == code) return;
    _language = code;
    await _prefs.setString(LocalStoreKeys.language, code);
    notifyListeners();
  }

  Future<void> toggleLanguage() async {
    await setLanguage(_language == 'en' ? 'km' : 'en');
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    _themeMode = mode;
    await _prefs.setString(
      LocalStoreKeys.storefrontTheme,
      mode == ThemeMode.dark ? 'dark' : 'light',
    );
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    await setThemeMode(_themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
}
