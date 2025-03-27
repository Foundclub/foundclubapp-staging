// store
import { useAppContext } from '../../store/appContext';
// utils
import { getAuthTokens } from './EXAMPLE-authUseCases';

/**
 * Custom hook to manage authentication
 * @inheritdoc
 */
export const useAuth = () => {
  // hooks
  const [, appDispatch] = useAppContext();

  // methods
  const logout = () => {
    appDispatch({ type: 'DELETE_AUTHENTICATION' });
  };

  /**
   * Save authentication tokens
   * @param {Partial<{ accessToken: string; refreshToken: string }>} param
   */
  const saveAuthTokens = ({ accessToken, refreshToken }) => {
    appDispatch({
      type: 'SET_AUTHENTICATION',
      payload: {
        accessToken,
        refreshToken,
      },
    });
  };

  return {
    getAuthTokens,
    logout,
    saveAuthTokens,
  };
};
