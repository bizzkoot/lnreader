import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Svg, G, Path, Circle } from 'react-native-svg';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { scaleDimension } from '@theme/scaling';
import AppText from '@components/AppText';
import { getString } from '@strings/translations';

interface Entry {
  key: string;
  value: number;
  label?: string;
}

interface Props {
  entries: Entry[];
  colors: Record<string, string>;
  total?: number;
}

const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeDonutSegment = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) => {
  const startOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
};

const DistributionBar: React.FC<Props> = ({ entries, colors, total }) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const styles = React.useMemo(() => createStyles(uiScale), [uiScale]);
  const sum = total ?? entries.reduce((a, e) => a + e.value, 0);

  if (!entries.length || sum === 0) {
    return (
      <AppText
        style={{
          color: theme.onSurfaceVariant,
          textAlign: 'center',
          padding: 12,
        }}
      >
        —
      </AppText>
    );
  }

  const size = scaleDimension(148, uiScale);
  const outerR = size / 2;
  const innerR = outerR * 0.62;
  const cx = size / 2;
  const cy = size / 2;
  const isSingleFull =
    entries.length === 1 && Math.abs(entries[0].value - sum) < 0.001;

  const visibleEntries: Entry[] = [];
  let otherValue = 0;
  for (const e of entries) {
    const sweep = sum > 0 ? (e.value / sum) * 360 : 0;
    if (!Number.isFinite(sweep) || sweep < 1.8) otherValue += e.value;
    else visibleEntries.push(e);
  }
  if (otherValue > 0) {
    visibleEntries.push({
      key: 'other',
      value: otherValue,
      label: getString('statsScreen.other'),
    });
  }

  let angle = 0;
  const segments = visibleEntries
    .map(e => {
      if (sum <= 0) return null;
      const sweep = (e.value / sum) * 360;
      if (!Number.isFinite(sweep) || sweep < 1.8) return null;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { entry: e, start, end };
    })
    .filter(Boolean) as Array<{ entry: Entry; start: number; end: number }>;

  const sortedForLegend = visibleEntries
    .slice()
    .sort((a, b) => b.value - a.value);

  return (
    <View style={styles.container}>
      <View style={styles.donutWrap}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G>
            {isSingleFull ? (
              <>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={outerR}
                  fill={colors[entries[0].key] ?? theme.primary}
                />
                <Circle cx={cx} cy={cy} r={innerR} fill={theme.surface} />
              </>
            ) : (
              <>
                {segments.map(s => (
                  <Path
                    key={s.entry.key}
                    d={describeDonutSegment(
                      cx,
                      cy,
                      outerR,
                      innerR,
                      s.start,
                      s.end,
                    )}
                    fill={colors[s.entry.key] ?? theme.primary}
                  />
                ))}
                {segments.length === 0 ? (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={outerR}
                    fill={theme.surfaceVariant}
                  />
                ) : null}
              </>
            )}
          </G>
        </Svg>
        <View style={[styles.centerLabel, { width: innerR * 1.6 }]}>
          <AppText
            style={[styles.centerValue, { color: theme.onSurface }]}
            numberOfLines={1}
          >
            {sum}
          </AppText>
          <AppText
            style={[styles.centerSub, { color: theme.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {getString('statsScreen.total')}
          </AppText>
        </View>
      </View>

      <View style={styles.legend}>
        {sortedForLegend.map(e => {
          const pct = Math.round((e.value / sum) * 100);
          return (
            <View key={e.key} style={styles.legendRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: colors[e.key] ?? theme.primary },
                ]}
              />
              <AppText
                style={[styles.legendLabel, { color: theme.onSurface }]}
                numberOfLines={1}
              >
                {e.label ?? e.key}
              </AppText>
              <AppText
                style={[styles.legendValue, { color: theme.onSurfaceVariant }]}
              >
                {e.value} · {pct}%
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (uiScale: number) =>
  StyleSheet.create({
    container: { paddingVertical: 8, alignItems: 'center' },
    donutWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabel: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerValue: {
      fontSize: scaleDimension(18, uiScale),
      fontWeight: 'bold',
      textAlign: 'center',
    },
    centerSub: {
      fontSize: scaleDimension(11, uiScale),
      textAlign: 'center',
      marginTop: 1,
    },
    legend: { marginTop: 14, gap: 8, alignSelf: 'stretch' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: {
      width: scaleDimension(10, uiScale),
      height: scaleDimension(10, uiScale),
      borderRadius: 5,
    },
    legendLabel: { flex: 1, fontSize: scaleDimension(13, uiScale) },
    legendValue: {
      fontSize: scaleDimension(11, uiScale),
      minWidth: 64,
      textAlign: 'right',
    },
  });

export default DistributionBar;
