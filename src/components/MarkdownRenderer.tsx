import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface MarkdownRendererProps {
  content: string;
  baseTextStyle?: TextStyle;
  compact?: boolean;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'code';
  text: string;
}

/**
 * Faz o parse de marcações inline (**negrito**, *itálico* e `código`)
 * para renderizar Text aninhados limpos sem expor asteriscos crus.
 */
function parseInlineMarkdown(raw: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: raw.slice(lastIndex, match.index),
      });
    }

    const segment = match[0];
    if (segment.startsWith('**') && segment.endsWith('**')) {
      tokens.push({
        type: 'bold',
        text: segment.slice(2, -2),
      });
    } else if (segment.startsWith('`') && segment.endsWith('`')) {
      tokens.push({
        type: 'code',
        text: segment.slice(1, -1),
      });
    } else if (segment.startsWith('*') && segment.endsWith('*')) {
      tokens.push({
        type: 'italic',
        text: segment.slice(1, -1),
      });
    } else {
      tokens.push({
        type: 'text',
        text: segment,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    tokens.push({
      type: 'text',
      text: raw.slice(lastIndex),
    });
  }

  // Limpa asteriscos residuais soltos caso o modelo tenha deixado algum ** não fechado
  return tokens.map((t) => ({
    ...t,
    text: t.text.replace(/\*\*/g, ''),
  }));
}

function renderInlineTokens(tokens: InlineToken[], extraStyle?: TextStyle) {
  return tokens.map((tok, i) => {
    if (tok.type === 'bold') {
      return (
        <Text key={i} style={[styles.inlineBold, extraStyle]}>
          {tok.text}
        </Text>
      );
    }
    if (tok.type === 'code') {
      return (
        <Text key={i} style={[styles.inlineCode, extraStyle]}>
          {tok.text}
        </Text>
      );
    }
    if (tok.type === 'italic') {
      return (
        <Text key={i} style={[styles.inlineItalic, extraStyle]}>
          {tok.text}
        </Text>
      );
    }
    return <Text key={i}>{tok.text}</Text>;
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  baseTextStyle,
  compact = false,
}) => {
  if (!content || !content.trim()) {
    return null;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    // Linha em branco -> espaçamento suave
    if (!line) {
      elements.push(
        <View key={`sp-${idx}`} style={{ height: compact ? 4 : 6 }} />
      );
      return;
    }

    // Divisor horizontal (---, ***, ___)
    if (/^([-*_]){3,}$/.test(line)) {
      elements.push(<View key={`hr-${idx}`} style={styles.divider} />);
      return;
    }

    // Cabeçalhos Markdown (#, ##, ###, ####)
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\*\*/g, '').trim();
      const tokens = parseInlineMarkdown(headingText);

      if (level === 1) {
        elements.push(
          <View key={`h1-${idx}`} style={styles.h1Container}>
            <Text style={styles.h1Text}>{renderInlineTokens(tokens)}</Text>
          </View>
        );
      } else if (level === 2) {
        elements.push(
          <View key={`h2-${idx}`} style={styles.h2Container}>
            <View style={styles.h2AccentBar} />
            <Text style={styles.h2Text}>{renderInlineTokens(tokens)}</Text>
          </View>
        );
      } else {
        elements.push(
          <View key={`h3-${idx}`} style={styles.h3Container}>
            <Text style={styles.h3Text}>{renderInlineTokens(tokens)}</Text>
          </View>
        );
      }
      return;
    }

    // Blockquote / Callout (> texto)
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      const tokens = parseInlineMarkdown(quoteMatch[1]);
      elements.push(
        <View key={`qt-${idx}`} style={styles.blockquoteBox}>
          <Text style={[styles.blockquoteText, baseTextStyle]}>
            {renderInlineTokens(tokens)}
          </Text>
        </View>
      );
      return;
    }

    // Lista numerada (1. texto, 2) texto)
    const orderedMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const itemTokens = parseInlineMarkdown(orderedMatch[2]);
      elements.push(
        <View key={`ol-${idx}`} style={styles.listRow}>
          <View style={styles.orderedNumberBadge}>
            <Text style={styles.orderedNumberText}>{num}</Text>
          </View>
          <Text style={[styles.paragraphText, styles.listItemText, baseTextStyle]}>
            {renderInlineTokens(itemTokens)}
          </Text>
        </View>
      );
      return;
    }

    // Lista com marcadores (- texto, * texto, • texto)
    const bulletMatch = line.match(/^([-*•])\s+(.*)$/);
    if (bulletMatch) {
      const itemTokens = parseInlineMarkdown(bulletMatch[2]);
      elements.push(
        <View key={`ul-${idx}`} style={styles.listRow}>
          <View style={styles.bulletDot} />
          <Text style={[styles.paragraphText, styles.listItemText, baseTextStyle]}>
            {renderInlineTokens(itemTokens)}
          </Text>
        </View>
      );
      return;
    }

    // Linha inteira em negrito funcionando como subtítulo (ex: **SEGUNDA-FEIRA: TREINO A**)
    if (line.startsWith('**') && line.endsWith('**') && line.length < 95) {
      const cleanTitle = line.slice(2, -2).replace(/\*\*/g, '').trim();
      elements.push(
        <View key={`sub-${idx}`} style={styles.h3Container}>
          <Text style={styles.h3Text}>{cleanTitle}</Text>
        </View>
      );
      return;
    }

    // Parágrafo padrão
    const tokens = parseInlineMarkdown(line);
    elements.push(
      <Text key={`p-${idx}`} style={[styles.paragraphText, baseTextStyle]}>
        {renderInlineTokens(tokens)}
      </Text>
    );
  });

  return <View style={styles.wrapper}>{elements}</View>;
};

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  h1Container: {
    marginTop: 8,
    marginBottom: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: obsidianTheme.border,
  },
  h1Text: {
    color: obsidianTheme.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  h2Container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  h2AccentBar: {
    width: 3,
    height: 15,
    borderRadius: 2,
    backgroundColor: obsidianTheme.accent,
  },
  h2Text: {
    color: obsidianTheme.textPrimary,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.1,
    flex: 1,
  },
  h3Container: {
    marginTop: 7,
    marginBottom: 2,
  },
  h3Text: {
    color: obsidianTheme.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paragraphText: {
    color: obsidianTheme.textSecondary,
    fontSize: 13.5,
    lineHeight: 21,
  },
  inlineBold: {
    color: obsidianTheme.textPrimary,
    fontWeight: '700',
  },
  inlineItalic: {
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  inlineCode: {
    color: obsidianTheme.accent,
    fontWeight: '700',
    backgroundColor: obsidianTheme.accentSoft,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginVertical: 2,
    gap: 9,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: obsidianTheme.accent,
    marginTop: 8,
  },
  orderedNumberBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    paddingHorizontal: 4,
  },
  orderedNumberText: {
    color: obsidianTheme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  listItemText: {
    flex: 1,
  },
  blockquoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: obsidianTheme.accent,
    backgroundColor: obsidianTheme.surfaceElevated,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  blockquoteText: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: obsidianTheme.border,
    marginVertical: 8,
  },
});
