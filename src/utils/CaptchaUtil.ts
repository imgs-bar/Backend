import Axios from 'axios';

export async function checkCaptcha(code: string): Promise<boolean> {
  const response = await Axios.get(
    'https://www.google.com/recaptcha/api/siteverify?secret=6LfOSuQaAAAAAHcTXjkTNYEQsPkinOJ0tpZT8dcN&response=' +
      code
  );
  return response.data.success;
}
