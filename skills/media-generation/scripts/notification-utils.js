export const DEFAULT_LOCALE = 'zh-CN';
export const DEFAULT_FALLBACK_LOCALE = 'en-US';

const LOCALE_ALIASES = Object.freeze({
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  'zh-hk': 'zh-HK',
  'zh-tw': 'zh-TW',
  en: 'en-US',
  'en-us': 'en-US',
  'en-gb': 'en-GB',
});

function toStringValue(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeLocale(locale) {
  const raw = toStringValue(locale).replace(/_/g, '-');
  if (!raw) return '';
  const alias = LOCALE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const [language, region] = raw.split('-');
  if (!language) return '';
  if (!region) return language.toLowerCase();
  return `${language.toLowerCase()}-${region.toUpperCase()}`;
}

function resolveLocaleChain(locale) {
  const normalized = normalizeLocale(locale);
  if (!normalized || normalized === 'auto') {
    return [DEFAULT_LOCALE, DEFAULT_FALLBACK_LOCALE];
  }
  const chain = [normalized];
  if (normalized.startsWith('zh-HK') || normalized.startsWith('zh-TW')) {
    chain.push('zh-CN');
  } else if (normalized.startsWith('en-') && normalized !== 'en-US') {
    chain.push('en-US');
  }
  if (!chain.includes(DEFAULT_LOCALE)) chain.push(DEFAULT_LOCALE);
  if (!chain.includes(DEFAULT_FALLBACK_LOCALE)) chain.push(DEFAULT_FALLBACK_LOCALE);
  return chain;
}

function normalizeFact(fact) {
  if (!fact) return null;
  if (Array.isArray(fact) && fact.length >= 2) {
    return {
      label: toStringValue(fact[0]),
      value: toStringValue(fact[1]),
    };
  }
  if (typeof fact === 'object') {
    return {
      label: toStringValue(fact.label),
      value: toStringValue(fact.value),
    };
  }
  return null;
}

function normalizeSection(section) {
  if (!section) return null;
  if (typeof section === 'string') {
    const text = toStringValue(section);
    return text ? { type: 'markdown', text } : null;
  }
  if (typeof section === 'object') {
    const text = toStringValue(section.text);
    return text ? { type: toStringValue(section.type) || 'markdown', text } : null;
  }
  return null;
}

function normalizeAction(action) {
  if (!action || typeof action !== 'object') return null;
  const label = toStringValue(action.label);
  const url = toStringValue(action.url);
  const type = toStringValue(action.type) || (url ? 'url' : 'note');
  if (!label) return null;
  return { type, label, url };
}

function buildModel({
  key,
  locale,
  title,
  theme = 'blue',
  summary = '',
  facts = [],
  sections = [],
  actions = [],
  footer = '',
  media = null,
}) {
  const model = {
    key,
    locale,
    title: toStringValue(title),
    theme: toStringValue(theme) || 'blue',
    summary: toStringValue(summary),
    facts: facts.map(normalizeFact).filter(Boolean),
    sections: sections.map(normalizeSection).filter(Boolean),
    actions: actions.map(normalizeAction).filter(Boolean),
    footer: toStringValue(footer),
    media: media && typeof media === 'object' && !Array.isArray(media)
      ? JSON.parse(JSON.stringify(media))
      : null,
  };
  model.fallback_text = renderMessagePlainText(model);
  return model;
}

function defineCatalogEntry(locales) {
  return locales;
}

const MESSAGE_CATALOG = Object.freeze({
  'install.success': defineCatalogEntry({
    'zh-CN': () => buildModel({
      key: 'install.success',
      locale: 'zh-CN',
      title: '✅ ModelMax Skills 安装成功！',
      theme: 'green',
      facts: [
        ['MCP 组件', 'modelmax-media 已注册 ✓'],
        ['API Key', '待配置'],
        ['自动充值', '待配置'],
      ],
      sections: [
        '请直接发送完整的、以 **sk-** 开头的 **ModelMax API Key** 给我。我会自动完成激活、余额检查和自动充值配置。',
      ],
      actions: [{ type: 'url', label: '🔑 获取 API Key', url: 'https://www.modelmax.io/dashboard/keys' }],
    }),
    'en-US': () => buildModel({
      key: 'install.success',
      locale: 'en-US',
      title: '✅ ModelMax Skills Installed',
      theme: 'green',
      facts: [
        ['MCP Component', 'modelmax-media registered ✓'],
        ['API Key', 'Pending'],
        ['Auto Top-Up', 'Pending'],
      ],
      sections: [
        'Send your full ModelMax API key starting with **sk-** and I will activate it, check the balance, and help configure auto top-up.',
      ],
      actions: [{ type: 'url', label: '🔑 Get API Key', url: 'https://www.modelmax.io/dashboard/keys' }],
    }),
  }),
  'config.verified': defineCatalogEntry({
    'zh-CN': (vars) => {
      const autoPayEnabled = Boolean(vars.autoPayEnabled);
      return buildModel({
        key: 'config.verified',
        locale: 'zh-CN',
        title: 'ModelMax 配置',
        theme: 'blue',
        facts: [
          ['API Key 状态', '已验证 ✓'],
          ['当前余额', `$${vars.balance} USD`],
          ['自动充值', autoPayEnabled ? '已开启 ✓' : '未开启'],
        ],
        sections: [
          autoPayEnabled
            ? '自动充值已激活。当余额不足时，系统将自动通过 Clink 钱包进行续费，确保生成任务不中断。'
            : '当余额不足时，自动充值可无感续费，避免图片/视频生成任务中断。默认不开启。如需开启，可直接回复「开启自动充值」或你语言中的等价表达：',
        ],
        actions: autoPayEnabled ? [] : [{ type: 'note', label: '开启自动充值' }],
      });
    },
    'en-US': (vars) => {
      const autoPayEnabled = Boolean(vars.autoPayEnabled);
      return buildModel({
        key: 'config.verified',
        locale: 'en-US',
        title: 'ModelMax Configuration',
        theme: 'blue',
        facts: [
          ['API Key Status', 'Verified ✓'],
          ['Current Balance', `$${vars.balance} USD`],
          ['Auto Top-Up', autoPayEnabled ? 'Enabled ✓' : 'Disabled'],
        ],
        sections: [
          autoPayEnabled
            ? 'Auto top-up is active. When your balance runs low, Clink will recharge the account automatically so generation tasks keep running.'
            : 'When your balance runs low, auto top-up prevents image and video generation from being interrupted. Reply with "Enable auto top-up" or an equivalent phrase in your language to enable it.',
        ],
        actions: autoPayEnabled ? [] : [{ type: 'note', label: 'Enable auto top-up' }],
      });
    },
  }),
  'autopay.enabled': defineCatalogEntry({
    'zh-CN': () => buildModel({
      key: 'autopay.enabled',
      locale: 'zh-CN',
      title: '✅ 自动充值已开启',
      theme: 'green',
      facts: [
        ['自动充值', '已开启 ✓'],
        ['支付渠道', 'Clink 钱包'],
      ],
      sections: ['自动充值已激活。当余额不足时，系统将自动通过 Clink 钱包进行续费，确保生成任务不中断。'],
    }),
    'en-US': () => buildModel({
      key: 'autopay.enabled',
      locale: 'en-US',
      title: '✅ Auto Top-Up Enabled',
      theme: 'green',
      facts: [
        ['Auto Top-Up', 'Enabled ✓'],
        ['Payment Channel', 'Clink Wallet'],
      ],
      sections: ['Auto top-up is active. When your balance runs low, Clink will recharge the account automatically to keep tasks running.'],
    }),
  }),
  'uninstall.success': defineCatalogEntry({
    'zh-CN': () => buildModel({
      key: 'uninstall.success',
      locale: 'zh-CN',
      title: '🗑️ ModelMax Skill 已卸载',
      theme: 'grey',
      facts: [
        ['MCP 注册', '已清除 ✓'],
        ['插件目录', '已删除 ✓'],
        ['API Key', '保留在 ~/.modelmax/config.json'],
      ],
      sections: ['ModelMax 图片/视频生成功能已完全移除。如需重新安装，请告知我。'],
    }),
    'en-US': () => buildModel({
      key: 'uninstall.success',
      locale: 'en-US',
      title: '🗑️ ModelMax Skill Uninstalled',
      theme: 'grey',
      facts: [
        ['MCP Registration', 'Removed ✓'],
        ['Plugin Directory', 'Deleted ✓'],
        ['API Key', 'Kept in ~/.modelmax/config.json'],
      ],
      sections: ['ModelMax image and video generation has been fully removed. Ask me if you want to install it again.'],
    }),
  }),
  'recharge.success': defineCatalogEntry({
    'zh-CN': (vars) => buildModel({
      key: 'recharge.success',
      locale: 'zh-CN',
      title: '✅ 充值成功',
      theme: 'green',
      facts: [
        ['充值金额', vars.amountDisplay],
        ['订单状态', '已到账'],
      ],
      sections: ['充值已成功到账，任务将自动继续执行。'],
    }),
    'en-US': (vars) => buildModel({
      key: 'recharge.success',
      locale: 'en-US',
      title: '✅ Recharge Successful',
      theme: 'green',
      facts: [
        ['Recharge Amount', vars.amountDisplay],
        ['Order Status', 'Credited'],
      ],
      sections: ['The recharge has been credited successfully and the task will continue automatically.'],
    }),
  }),
  'recharge.failed': defineCatalogEntry({
    'zh-CN': (vars) => buildModel({
      key: 'recharge.failed',
      locale: 'zh-CN',
      title: '❌ 充值失败',
      theme: 'red',
      facts: [
        ['订单号', vars.orderId],
        ['订单状态', '失败'],
      ],
      sections: ['充值未到账，请联系商户支持并提供以上订单号。'],
      actions: [{ type: 'url', label: '联系支持', url: vars.supportUrl }],
    }),
    'en-US': (vars) => buildModel({
      key: 'recharge.failed',
      locale: 'en-US',
      title: '❌ Recharge Failed',
      theme: 'red',
      facts: [
        ['Order ID', vars.orderId],
        ['Order Status', 'Failed'],
      ],
      sections: ['The recharge was not credited. Contact support and share the order ID above.'],
      actions: [{ type: 'url', label: 'Contact Support', url: vars.supportUrl }],
    }),
  }),
  'recharge.timeout': defineCatalogEntry({
    'zh-CN': (vars) => buildModel({
      key: 'recharge.timeout',
      locale: 'zh-CN',
      title: '⏳ 充值确认超时',
      theme: 'orange',
      facts: [
        ['订单号', vars.orderId],
        ['订单状态', '待确认'],
      ],
      sections: ['60 秒内未收到到账确认，请前往 ModelMax 账户查看余额，或联系支持并提供以上订单号。'],
      actions: [{ type: 'url', label: '联系支持', url: vars.supportUrl }],
    }),
    'en-US': (vars) => buildModel({
      key: 'recharge.timeout',
      locale: 'en-US',
      title: '⏳ Recharge Confirmation Timed Out',
      theme: 'orange',
      facts: [
        ['Order ID', vars.orderId],
        ['Order Status', 'Pending confirmation'],
      ],
      sections: ['No recharge confirmation arrived within 60 seconds. Check the ModelMax balance or contact support with the order ID above.'],
      actions: [{ type: 'url', label: 'Contact Support', url: vars.supportUrl }],
    }),
  }),
});

export function createMessageRequest({ messageKey, vars = {}, locale = 'auto', deliveryPolicy = {} }) {
  if (!toStringValue(messageKey)) {
    throw new Error('messageKey is required');
  }
  if (!MESSAGE_CATALOG[messageKey]) {
    throw new Error(`Unknown message key: ${messageKey}`);
  }
  return {
    message_key: messageKey,
    vars: JSON.parse(JSON.stringify(vars)),
    locale: locale === 'auto' ? 'auto' : normalizeLocale(locale) || 'auto',
    delivery_policy: {
      prefer_rich: deliveryPolicy.prefer_rich !== false,
      allow_fallback: deliveryPolicy.allow_fallback !== false,
    },
  };
}

export function compileMessage(request, { preferredLocale = 'auto' } = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Message request must be an object');
  }
  const messageKey = toStringValue(request.message_key || request.messageKey);
  if (!messageKey) {
    throw new Error('message_key is required');
  }
  const entry = MESSAGE_CATALOG[messageKey];
  if (!entry) {
    throw new Error(`Unknown message key: ${messageKey}`);
  }
  const localeChain = resolveLocaleChain(request.locale === 'auto' ? preferredLocale : request.locale);
  const locale = localeChain.find((candidate) => entry[candidate]) || Object.keys(entry)[0];
  return entry[locale](request.vars || {});
}

export function renderMessagePlainText(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  const sections = [];
  if (model.title) sections.push(model.title);
  if (model.summary) sections.push(model.summary);
  if (model.facts.length > 0) {
    sections.push(model.facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n'));
  }
  if (model.sections.length > 0) {
    sections.push(model.sections.map((section) => section.text).join('\n\n'));
  }
  if (model.actions.length > 0) {
    sections.push(model.actions.map((action) => (
      action.type === 'url' && action.url
        ? `${action.label}: ${action.url}`
        : `- ${action.label}`
    )).join('\n'));
  }
  if (model.footer) sections.push(model.footer);
  return sections.filter(Boolean).join('\n\n').trim();
}

export function renderMessageMarkdown(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  const sections = [];
  if (model.title) sections.push(`**${model.title}**`);
  if (model.summary) sections.push(model.summary);
  if (model.facts.length > 0) {
    sections.push(model.facts.map((fact) => `**${fact.label}** ${fact.value}`).join('\n'));
  }
  if (model.sections.length > 0) {
    sections.push(model.sections.map((section) => section.text).join('\n\n'));
  }
  if (model.actions.length > 0) {
    sections.push(model.actions.map((action) => (
      action.type === 'url' && action.url
        ? `- [${action.label}](${action.url})`
        : `- ${action.label}`
    )).join('\n'));
  }
  if (model.footer) sections.push(model.footer);
  return sections.filter(Boolean).join('\n\n').trim();
}

function buildTelegramHeaderSections(model) {
  const sections = [];
  if (model.title) sections.push(`**${model.title}**`);
  if (model.summary) sections.push(model.summary);
  return sections.filter(Boolean);
}

function isTelegramChineseLocale(locale) {
  return toStringValue(locale).toLowerCase().startsWith('zh');
}

function getTelegramSectionLabels(locale) {
  return isTelegramChineseLocale(locale)
    ? {
      facts: '📌 关键信息',
      details: '📝 说明',
      actions: '👉 下一步',
      footer: 'ℹ️ 补充信息',
    }
    : {
      facts: '📌 Highlights',
      details: '📝 Details',
      actions: '👉 Next Steps',
      footer: 'ℹ️ More Info',
    };
}

function buildTelegramSection(title, content) {
  const text = toStringValue(content);
  if (!text) return '';
  return `**${title}**\n${text}`;
}

function buildTelegramBodySections(model) {
  const labels = getTelegramSectionLabels(model.locale);
  const sections = [];
  if (model.facts.length > 0) {
    sections.push(buildTelegramSection(
      labels.facts,
      model.facts.map((fact) => `• **${fact.label}** ${fact.value}`.trim()).join('\n'),
    ));
  }
  if (model.sections.length > 0) {
    sections.push(buildTelegramSection(
      labels.details,
      model.sections.map((section) => section.text).join('\n\n'),
    ));
  }
  if (model.actions.length > 0) {
    sections.push(buildTelegramSection(
      labels.actions,
      model.actions.map((action) => (
        action.type === 'url' && action.url
          ? `• [${action.label}](${action.url})`
          : `• ${action.label}`
      )).join('\n'),
    ));
  }
  if (model.footer) sections.push(buildTelegramSection(labels.footer, model.footer));
  return sections.filter(Boolean);
}

export function renderMessageTelegramText(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  const header = buildTelegramHeaderSections(model);
  const body = buildTelegramBodySections(model);
  if (header.length > 0 && body.length > 0) {
    return `${header.join('\n\n')}\n\n━━━━━━━━━━\n\n${body.join('\n\n')}`.trim();
  }
  if (header.length > 0) {
    return header.join('\n\n').trim();
  }
  return body.join('\n\n').trim();
}

export function renderMessageFeishuCard(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  const elements = [];
  if (model.summary) {
    elements.push({ tag: 'markdown', content: model.summary });
  }
  if (model.facts.length > 0) {
    if (elements.length > 0) elements.push({ tag: 'hr' });
    elements.push({
      tag: 'markdown',
      content: model.facts.map((fact) => `**${fact.label}**　${fact.value}`).join('\n'),
    });
  }
  if (model.sections.length > 0) {
    if (elements.length > 0) elements.push({ tag: 'hr' });
    model.sections.forEach((section) => {
      elements.push({ tag: 'markdown', content: section.text });
    });
  }
  if (model.actions.length > 0) {
    if (elements.length > 0) elements.push({ tag: 'hr' });
    const passive = model.actions.filter((action) => action.type !== 'url' || !action.url);
    if (passive.length > 0) {
      elements.push({
        tag: 'markdown',
        content: passive.map((action) => `- ${action.label}`).join('\n'),
      });
    }
    model.actions
      .filter((action) => action.type === 'url' && action.url)
      .forEach((action) => {
        elements.push({
          tag: 'button',
          text: { tag: 'plain_text', content: action.label },
          multi_url: {
            url: action.url,
            pc_url: action.url,
            ios_url: action.url,
            android_url: action.url,
          },
        });
      });
  }
  if (model.footer) {
    if (elements.length > 0) elements.push({ tag: 'hr' });
    elements.push({ tag: 'markdown', content: model.footer });
  }
  return {
    schema: '2.0',
    header: {
      title: { content: model.title || 'Notification', tag: 'plain_text' },
      template: model.theme,
    },
    body: { elements },
  };
}

export function renderMessageTelegramCard(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  return {
    schema: 'telegram-card/v1',
    version: 1,
    mode: model.media ? 'media_card' : 'text_card',
    card: {
      title: model.title,
      theme: model.theme,
      summary: model.summary,
      facts: model.facts.map((fact) => ({ label: fact.label, value: fact.value })),
      sections: model.sections.map((section) => ({ type: section.type, text: section.text })),
      actions: model.actions.map((action) => ({
        type: action.type,
        label: action.label,
        ...(action.url ? { url: action.url } : {}),
      })),
      ...(model.footer ? { footer: model.footer } : {}),
      ...(model.media ? { media: model.media } : {}),
    },
  };
}

export function normalizeMessageRequest(value, { preferredLocale = 'auto' } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Message request payload must be an object');
  }
  return createMessageRequest({
    messageKey: value.message_key || value.messageKey,
    vars: value.vars || {},
    locale: value.locale === 'auto' ? preferredLocale : (value.locale || preferredLocale || 'auto'),
    deliveryPolicy: value.delivery_policy || value.deliveryPolicy || {},
  });
}

export function resolvePreferredLocale(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

export function buildMessagePreview(input, options = {}) {
  const model = input?.message_key ? compileMessage(input, options) : input;
  return {
    title: model.title || model.key,
    markdown: renderMessageMarkdown(model),
  };
}
