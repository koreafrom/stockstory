import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../main.dart';

// 내 관심종목의 공시를 최신순으로 보여주는 피드.
// disclosures 테이블(수집기가 채움)에서 내 watchlist 종목만 필터.
class DisclosuresScreen extends StatefulWidget {
  const DisclosuresScreen({super.key});

  @override
  State<DisclosuresScreen> createState() => _DisclosuresScreenState();
}

class _DisclosuresScreenState extends State<DisclosuresScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _noWatchlist = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final wl = await supabase.from('watchlist').select('symbol');
      final symbols =
          (wl as List).map((e) => e['symbol'] as String).toSet().toList();

      if (symbols.isEmpty) {
        _items = [];
        _noWatchlist = true;
      } else {
        _noWatchlist = false;
        final data = await supabase
            .from('disclosures')
            .select()
            .inFilter('symbol', symbols)
            .order('filed_at', ascending: false, nullsFirst: false)
            .limit(100);
        _items = (data as List).cast<Map<String, dynamic>>();
      }
    } catch (e) {
      _toast('불러오기 실패: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) _toast('링크를 열 수 없어요.');
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('공시 · 소식')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _noWatchlist
              ? _msg('관심종목을 추가하면\n공시가 여기에 모여요.')
              : _items.isEmpty
                  ? _msg('아직 수집된 공시가 없어요.\n잠시 후 다시 확인해 주세요.')
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _card(_items[i]),
                      ),
                    ),
    );
  }

  Widget _msg(String text) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(text, textAlign: TextAlign.center),
        ),
      );

  Widget _card(Map<String, dynamic> it) {
    final market = (it['market'] ?? '') as String;
    final symbol = (it['symbol'] ?? '') as String;
    final title = (it['title'] ?? '') as String;
    final filer = (it['filer'] ?? '') as String?;
    final filedAt = (it['filed_at'] ?? '') as String?;
    final summary = it['summary'] as String?;
    final url = it['url'] as String?;
    final badge = market == 'US' ? '8-K' : '공시';

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: () => _open(url),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _Badge(badge),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '$symbol · $title',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w500),
                    ),
                  ),
                  const Icon(Icons.open_in_new, size: 16, color: Colors.black38),
                ],
              ),
              if (summary != null && summary.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.auto_awesome, size: 14, color: Colors.black38),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(summary,
                          style: const TextStyle(color: Colors.black54, fontSize: 13)),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              Text(
                [filer, filedAt].where((e) => e != null && e.isNotEmpty).join(' · '),
                style: const TextStyle(color: Colors.black38, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFE6F1FB),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 11, color: Color(0xFF0C447C))),
    );
  }
}
