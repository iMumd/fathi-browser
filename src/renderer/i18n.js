
      'about.tagline': 'متصفح خاص بهوية مختلفة في كل تبويب',
      'about.version': 'الإصدار {v}',
      'about.engine': 'المحرّك',
      'about.chromium': 'Chromium',
      'about.electron': 'Electron',
      'about.system': 'النظام',
      'about.privacyTitle': 'الخصوصية',
      'about.privacy': 'لا يُكتب أي شيء عن تصفّحك على القرص: لا كوكيز، لا سجل، لا كاش، لا كلمات مرور. جلسات التبويبات في الذاكرة فقط وتُمسح عند الإغلاق. الإعدادات وحدها هي ما يُحفظ.',
      'about.credit': 'تطوير Muhammed',
      'about.creditSub': 'أسئلة أو أفكار أو دعم. أرسل رسالة على تيليجرام.',
      'about.message': 'مراسلة على تيليجرام',
      'about.openSource': 'مفتوح المصدر',
      'about.openSourceText': 'مبني على Chromium عبر Electron. قاعدة كود واحدة لويندوز ولينكس.',

      'newtab.greeting': 'مرحباً. هوية جديدة جاهزة لهذا التبويب',
      'newtab.search': 'ابحث في الويب أو أدخل عنواناً',
      'newtab.go': 'بحث',
      'newtab.fpHead': 'بصمة هذا التبويب فريدة',
      'newtab.rotate': 'هوية جديدة',
      'newtab.ext': 'إضافة من المتجر',
      'newtab.proxy': 'البروكسي',
      'newtab.direct': 'مباشر',
      'newtab.credit': 'خلفية من Unsplash',
      'newtab.tab': 'تبويب',
      'newtab.installPrompt': 'الصق رابط الإضافة من Chrome Web Store أو معرّفها:',
      'newtab.installed': 'تم تثبيت: {name}',
      'newtab.failed': 'فشل: {error}',
      'newtab.os.windows': 'Windows',
      'newtab.os.mac': 'macOS',
      'newtab.os.linux': 'Linux',
      'newtab.os.android': 'Android',
      'newtab.os.ios': 'iOS',
      'newtab.cores': '{n} أنوية'
    }
  };

  const listeners = new Set();
  let lang = 'en';

  function format(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));
  }
