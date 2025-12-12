import React, { FormEvent } from 'react';
import { useTranslation } from '../../lib/i18n';
import { useLogIn } from './useLogIn';

type LogInProps = {
  profileId: string;
  profileName: string;
  onBack: () => void;
  onSuccess: () => void;
};

const LogIn: React.FC<LogInProps> = ({
  profileId,
  profileName,
  onBack,
  onSuccess,
}) => {
  const { t } = useTranslation('LogIn');
  const { password, setPassword, submit, error } = useLogIn(
    profileId,
    onSuccess,
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-header">
          <h1 className="login-title">{t('title')}</h1>
          <p className="login-subtitle">{t('subtitle')}</p>
        </header>

        {/* выбранный профиль */}
        <div className="profile-card login-selected-profile">
          <div className="profile-meta">
            <p className="muted" style={{ marginBottom: 4 }}>
              {t('selectedProfile')}
            </p>
            <p className="profile-name">
              {profileName || t('unnamedProfile')}
            </p>
            <p className="profile-id">ID: {profileId}</p>
          </div>
        </div>

        {/* форма логина */}
        <form className="login-form form-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="login-password">
              {t('passwordLabel')}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
            />
          </div>

          {error && <div className="form-error">{t('error')}</div>}

          <div className="login-actions button-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
            >
              {t('back')}
            </button>
            <button type="submit" className="btn btn-primary">
              {t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogIn;
