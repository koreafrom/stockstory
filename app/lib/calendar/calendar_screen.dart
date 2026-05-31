import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../main.dart';

// 공모주/상장 일정. ipo_events(수집기가 채움)를 날짜순으로 묶어 보여준다.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  List<Map<String, dynamic>> _all = [];
  bool _loading = true;
  String _filter = 'ALL'; // ALL / KR / US

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      // 국내 공모는 '신고서 제출일' 기준이라 최근 7일치까지 포함해 보여준다.
      final from = DateTime.now()
          .subtract(const Duration(days: 7))
          .toIso8601String()
          .substring(0, 10);
      final data = await supabase
          .from('ipo_events')
          .select()
          .gte('event_date', from)
          .order('event_date', ascending: true)
          .limit(200);
      _all = (data as List).cast<Map<String, dynamic>>();
    } catch (e) {
      _toast('불러오기 실패: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  List<Map<String, dynamic>> get _filtered =>
      _filter == 'ALL' ? _all : _all.where((e) => e['market'] == _filter).toList();

  String _dday(String date) {
    final d = DateTime.tryParse(date);
    if (d == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final diff = DateTime(d.year, d.month, d.day).difference(today).inDays;
    if (diff == 0) return 'D-DAY';
    return diff > 0 ? 'D-$diff' : 'D+${-diff}';
  }

  String _dateHeader(String date) {
    final d = DateTime.parse(date);
    const w = ['월', '화', '수', '목', '금', '토', '일'];
    return '${d.month}/${d.day} (${w[d.weekday - 1]})';
  }

  String _kindLabel(String kind) {
    switch (kind) {
      case 'subscribe_start':
        return '청약시작';
      case 'subscribe_end':
        return '청약마감';
      case 'refund':
        return '환불';
      case 'listing':
        return '상장';
      default:
        return '공모주';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('투자 캘린더')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: Row(
              children: [
                _chip('전체', 'ALL'),
                const SizedBox(width: 6),
                _chip('국내', 'KR'),
                const SizedBox(width: 6),
                _chip('해외', 'US'),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          children: const [
                            SizedBox(height: 120),
                            Center(child: Text('예정된 일정이 없어요.')),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.all(12),
                          children: _buildRows(),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, String value) {
    return ChoiceChip(
      label: Text(label),
      selected: _filter == value,
      onSelected: (_) => setState(() => _filter = value),
    );
  }

  List<Widget> _buildRows() {
    final rows = <Widget>[];
    String? lastDate;
    for (final e in _filtered) {
      final date = e['event_date'] as String;
      if (date != lastDate) {
        rows.add(Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 4),
          child: Text(_dateHeader(date),
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w500, color: Colors.black45)),
        ));
        lastDate = date;
      }
      rows.add(_card(e));
    }
    return rows;
  }

  Widget _card(Map<String, dynamic> e) {
    final market = (e['market'] ?? '') as String;
    final name = (e['name'] ?? '') as String;
    final kind = (e['kind'] ?? 'ipo') as String;
    final exchange = (e['exchange'] ?? '') as String?;
    final price = (e['price_range'] ?? '') as String?;
    final url = e['url'] as String?;
    final sub = [exchange, price].where((x) => x != null && x.isNotEmpty).join(' · ');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: (url != null && url.isNotEmpty) ? () => _open(url) : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _Badge(_kindLabel(kind)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(name,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w500)),
                        ),
                        const SizedBox(width: 6),
                        Text(market,
                            style: const TextStyle(fontSize: 11, color: Colors.black45)),
                      ],
                    ),
                    if (sub.isNotEmpty)
                      Text(sub,
                          style: const TextStyle(fontSize: 12, color: Colors.black45)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(_dday(e['event_date'] as String),
                  style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok) _toast('링크를 열 수 없어요.');
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFEEEDFE),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(text,
          style: const TextStyle(fontSize: 11, color: Color(0xFF3C3489))),
    );
  }
}
