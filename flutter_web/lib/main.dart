import 'package:flutter/material.dart';

/// Adaptive 5-Screen Basketball AI Studio (Web & Multi-Window Ready)
/// Built following `flutter-build-responsive-layout`:
/// - Uses `LayoutBuilder` (`constraints.maxWidth > 600`) to switch between a
///   side-by-side `NavigationRail` desktop layout and a compact `NavigationBar` mobile layout.
/// - Uses `ConstrainedBox(constraints: BoxConstraints(maxWidth: 960))` wrapped in `Center`
///   to prevent forms and cards from stretching across ultrawide monitors.
/// - Uses `GridView.builder` with `SliverGridDelegateWithMaxCrossAxisExtent` for
///   the Clip Library and MVP Candidate cards.
void main() {
  runApp(const BasketballAiStudioApp());
}

const double kLargeScreenMinWidth = 600.0;
const double kOptimalContentMaxWidth = 960.0;

class BasketballAiStudioApp extends StatelessWidget {
  const BasketballAiStudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Basketball AI Studio — Live Clipper & MVP Agent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0D12),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F8CFF),
          brightness: Brightness.dark,
          surface: const Color(0xFF141821),
        ),
      ),
      home: const AdaptiveBasketballStudioShell(),
    );
  }
}

class AdaptiveBasketballStudioShell extends StatefulWidget {
  const AdaptiveBasketballStudioShell({super.key});

  @override
  State<AdaptiveBasketballStudioShell> createState() =>
      _AdaptiveBasketballStudioShellState();
}

class _AdaptiveBasketballStudioShellState
    extends State<AdaptiveBasketballStudioShell> {
  int _selectedIndex = 0;

  static const List<NavigationDestination> _destinations = [
    NavigationDestination(
      icon: Icon(Icons.live_tv_outlined),
      selectedIcon: Icon(Icons.live_tv),
      label: 'Games & Source',
    ),
    NavigationDestination(
      icon: Icon(Icons.podcasts_outlined),
      selectedIcon: Icon(Icons.podcasts),
      label: 'Live Monitor',
    ),
    NavigationDestination(
      icon: Icon(Icons.video_library_outlined),
      selectedIcon: Icon(Icons.video_library),
      label: 'Clip Library',
    ),
    NavigationDestination(
      icon: Icon(Icons.emoji_events_outlined),
      selectedIcon: Icon(Icons.emoji_events),
      label: 'MVP Candidates',
    ),
    NavigationDestination(
      icon: Icon(Icons.movie_creation_outlined),
      selectedIcon: Icon(Icons.movie_creation),
      label: 'Production',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth > kLargeScreenMinWidth) {
          return _buildLargeScreenLayout(constraints.maxWidth);
        } else {
          return _buildSmallScreenLayout();
        }
      },
    );
  }

  Widget _buildLargeScreenLayout(double maxWidth) {
    final bool extendedRail = maxWidth >= 960;
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: extendedRail,
            selectedIndex: _selectedIndex,
            onDestinationSelected: (idx) =>
                setState(() => _selectedIndex = idx),
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
              child: Text(
                extendedRail ? 'Basketball AI Studio' : 'VidOps',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
            destinations: _destinations
                .map(
                  (d) => NavigationRailDestination(
                    icon: d.icon,
                    selectedIcon: d.selectedIcon,
                    label: Text(d.label),
                  ),
                )
                .toList(),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: _buildConstrainedBody()),
        ],
      ),
    );
  }

  Widget _buildSmallScreenLayout() {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Basketball AI Studio'),
      ),
      body: _buildConstrainedBody(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (idx) => setState(() => _selectedIndex = idx),
        destinations: _destinations,
      ),
    );
  }

  Widget _buildConstrainedBody() {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: kOptimalContentMaxWidth),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: _buildActiveScreen(),
        ),
      ),
    );
  }

  Widget _buildActiveScreen() {
    return GridView.builder(
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 440.0,
        mainAxisSpacing: 14.0,
        crossAxisSpacing: 14.0,
        childAspectRatio: 1.45,
      ),
      itemCount: 4,
      itemBuilder: (context, index) {
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_destinations[_selectedIndex].label} — Card #${index + 1}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 8),
                const Expanded(
                  child: Text(
                    'YD League (GAME_1743500926740597) • Authorized Media Ready • Continuous Segmented Recording Active',
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
