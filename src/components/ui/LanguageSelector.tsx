import type React from 'react';

import { useTranslation } from 'react-i18next';
import { FiGlobe } from 'react-icons/fi';

import Selector from '../forms/Selector';

interface LanguageSelectorProps {
  className?: string;
  id: string;
  'data-testid'?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
  id,
  'data-testid': dataTestId,
}) => {
  const { i18n } = useTranslation();

  const options = [
    { id: 'ja', textValue: 'ja', label: '日本語' },
    { id: 'en', textValue: 'en', label: 'English' },
    { id: 'cn', textValue: 'cn', label: '中文' },
    { id: 'kr', textValue: 'kr', label: '한국어' },
    { id: 'de', textValue: 'de', label: 'Deutsch' },
    { id: 'fr', textValue: 'fr', label: 'Français' },
    { id: 'pt', textValue: 'pt', label: 'Português' },
    { id: 'es', textValue: 'es', label: 'Español' },
    { id: 'nl', textValue: 'nl', label: 'Nederlands' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className={className}>
      <Selector
        id={id}
        data-testid={dataTestId}
        name="language"
        control={undefined}
        ariaLabel="Select language"
        options={options}
        onChange={changeLanguage}
        value={i18n.language}
        buttonLabel={
          <>
            <FiGlobe className="text-lg" />
          </>
        }
      />
    </div>
  );
};

export default LanguageSelector;
