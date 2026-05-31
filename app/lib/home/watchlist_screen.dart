import 'package:flutter/material.dart';

import '../main.dart';
import 'add_stock_screen.dart';

class WatchlistScreen extends StatefulWidget {
  const WatchlistScreen({super.key});

  @override
  State<WatchlistScreen> createState() => _WatchlistScreenState();
}

class _WatchlistScreenState extends State<WatchlistScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final data = await supabase
          .from('watchlist')
          .select()
          .order('created_at');
      _items = (data as List).cast<Map<String, dynamic>>();
    } catch (e) {
      _toast('불러오기 실패: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(String id) async {
    try {
      await supabase.from('watchlist').delete().eq('id', id);
      await _load();
    } catch (e) {
      _toast('삭제 실패: $e');
    }
  }

  Future<void> _add() async {
    final added = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddStockScreen()),
    );
    if (added == true) _load();
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('내 종목 한눈에'),
        actions: [IconButton(onPressed: _add, icon: const Icon(Icons.add))],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _items.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) => _card(_items[i]),
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _add,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _empty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.star_border, size: 48, color: Colors.black38),
          const SizedBox(height: 12),
          const Text('아직 관심종목이 없어요.'),
          const SizedBox(height: 12),
          FilledButton.tonal(onPressed: _add, child: const Text('종목 추가')),
        ],
      ),
    );
  }

  Widget _card(Map<String, dynamic> it) {
    final market = (it['market'] ?? '') as String;
    final symbol = (it['symbol'] ?? '') as String;
    final name = ((it['name'] ?? '') as String).isNotEmpty
        ? it['name'] as String
        : symbol;
    final initial = name.isNotEmpty ? name.substring(0, 1) : '?';

    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: CircleAvatar(child: Text(initial)),
        title: Row(
          children: [
            Flexible(child: Text(name, overflow: TextOverflow.ellipsis)),
            const SizedBox(width: 6),
            _MarketTag(market),
          ],
        ),
        subtitle: Text(symbol),
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: () => _delete(it['id'].toString()),
        ),
      ),
    );
  }
}

class _MarketTag extends StatelessWidget {
  const _MarketTag(this.market);
  final String market;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: Colors.black12,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        market,
        style: const TextStyle(fontSize: 11, color: Colors.black54),
      ),
    );
  }
}
