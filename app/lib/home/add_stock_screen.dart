import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../main.dart';

class AddStockScreen extends StatefulWidget {
  const AddStockScreen({super.key});

  @override
  State<AddStockScreen> createState() => _AddStockScreenState();
}

class _AddStockScreenState extends State<AddStockScreen> {
  String _market = 'KR';
  final _q = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _searching = false;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _q.text.trim();
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final data = await supabase
          .from('stocks')
          .select()
          .eq('market', _market)
          .or('name.ilike.%$q%,symbol.ilike.%$q%')
          .limit(20);
      _results = (data as List).cast<Map<String, dynamic>>();
    } catch (e) {
      _toast('검색 실패: $e');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _add({
    required String market,
    required String symbol,
    required String name,
    String? corpCode,
  }) async {
    final user = supabase.auth.currentUser;
    if (user == null) return;
    try {
      await supabase.from('watchlist').insert({
        'user_id': user.id,
        'market': market,
        'symbol': symbol,
        'corp_code': corpCode,
        'name': name,
      });
      if (mounted) Navigator.of(context).pop(true);
    } on PostgrestException catch (e) {
      if (e.code == '23505') {
        _toast('이미 추가된 종목이에요.');
      } else {
        _toast('추가 실패: ${e.message}');
      }
    } catch (e) {
      _toast('추가 실패: $e');
    }
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  // 검색 결과에 없을 때 직접 입력
  Future<void> _manualAdd() async {
    final symbolCtrl = TextEditingController(text: _q.text.trim());
    final nameCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('$_market 종목 직접 추가'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: symbolCtrl,
              decoration: InputDecoration(
                labelText: _market == 'KR' ? '종목코드 (6자리)' : '티커',
              ),
            ),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: '종목명'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('추가')),
        ],
      ),
    );
    if (ok == true) {
      final sym = symbolCtrl.text.trim();
      final nm = nameCtrl.text.trim();
      if (sym.isEmpty) {
        _toast('코드/티커를 입력하세요.');
        return;
      }
      await _add(market: _market, symbol: sym, name: nm.isEmpty ? sym : nm);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('종목 추가')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'KR', label: Text('국내')),
                    ButtonSegment(value: 'US', label: Text('해외')),
                  ],
                  selected: {_market},
                  onSelectionChanged: (s) {
                    setState(() {
                      _market = s.first;
                      _results = [];
                    });
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _q,
                  onChanged: (_) => _search(),
                  decoration: InputDecoration(
                    hintText: _market == 'KR' ? '종목명 또는 코드' : '종목명 또는 티커',
                    prefixIcon: const Icon(Icons.search),
                    border: const OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          if (_searching) const LinearProgressIndicator(),
          Expanded(
            child: ListView(
              children: [
                ..._results.map(
                  (s) => ListTile(
                    title: Text((s['name'] ?? s['symbol']) as String),
                    subtitle: Text(s['symbol'] as String),
                    trailing: const Icon(Icons.add),
                    onTap: () => _add(
                      market: s['market'] as String,
                      symbol: s['symbol'] as String,
                      name: (s['name'] ?? s['symbol']) as String,
                      corpCode: s['corp_code'] as String?,
                    ),
                  ),
                ),
                if (_q.text.trim().isNotEmpty)
                  ListTile(
                    leading: const Icon(Icons.edit_outlined),
                    title: const Text('검색 결과에 없어요? 직접 추가'),
                    onTap: _manualAdd,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
