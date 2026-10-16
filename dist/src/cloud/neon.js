export const AUTH_URL='https://ep-raspy-moon-aosbozvt.neonauth.c-2.ap-southeast-1.aws.neon.tech/neondb/auth';
export const DATA_URL='https://ep-raspy-moon-aosbozvt.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1';
const codes={INVALID_EMAIL_OR_PASSWORD:'이메일과 비밀번호를 확인해 주세요.',EMAIL_NOT_VERIFIED:'이메일 인증을 완료해 주세요.',INVALID_OTP:'인증번호를 확인해 주세요.',OTP_EXPIRED:'인증번호가 만료되었습니다. 새 번호를 요청해 주세요.',TOO_MANY_ATTEMPTS:'요청이 많습니다. 잠시 후 다시 시도해 주세요.',USER_ALREADY_EXISTS:'가입할 수 없습니다. 기존 계정이라면 로그인 또는 비밀번호 찾기를 이용해 주세요.',PASSWORD_TOO_SHORT:'비밀번호는 12자 이상 입력해 주세요.',PASSWORD_TOO_LONG:'비밀번호는 128자 이하로 입력해 주세요.'};
export function publicError(error) {
  const code=error?.code||'';
  if(code==='SESSION_UNAVAILABLE')return '이 브라우저에서 로그인 세션을 유지하지 못했습니다. 다른 브라우저에서 다시 시도하거나 기록·백업으로 학습을 이어가세요. 이메일 미인증 오류는 아닙니다.';
  if(code==='INVALID_ORIGIN')return '현재 접속 주소에서는 로그인을 허용하지 않습니다. 공개 사이트 주소에서 다시 시도해 주세요.';
  if(codes[code])return codes[code];
  if(error?.status===429||error?.message==='RATE_LIMIT')return '요청이 많습니다. 잠시 후 다시 동기화해 주세요.';
  if(error?.status===401||error?.status===403||code==='AUTH_REQUIRED'||error?.message==='AUTH_REQUIRED')return '로그인이 만료되었거나 이메일 인증이 필요합니다. 다시 로그인해 주세요.';
  if(['22023','22007','22008','22P02','23514'].includes(code))return '기록 형식을 서버에서 확인하지 못했습니다. 대기 기록을 백업한 뒤 다시 확인해 주세요.';
  return '연결을 완료하지 못했습니다. 대기 기록은 유지됩니다. 네트워크를 확인한 뒤 다시 시도해 주세요.';
}
export async function createNeonTransport() {
  const {createClient,BetterAuthVanillaAdapter}=await import('../../vendor/neon.js');
  const client=createClient({auth:{url:AUTH_URL,adapter:BetterAuthVanillaAdapter({fetchOptions:{timeout:20000,retry:0}})},dataApi:{url:DATA_URL}});
  async function result(promise) {const value=await promise;if(value?.error)throw value.error;return value?.data;}
  return {
    async session() {const data=await result(client.auth.getSession({fetchOptions:{headers:{'X-Force-Fetch':'true'}}}));return data?.user?{id:data.user.id,email:data.user.email,emailVerified:data.user.emailVerified}:null;},
    async signIn(email,password){await result(client.auth.signIn.email({email,password}));return this.session();},
    async signUp(email,password){await result(client.auth.signUp.email({email,password,name:'학습자'}));},
    async verify(email,otp){await result(client.auth.emailOtp.verifyEmail({email,otp}));},
    async resend(email){await result(client.auth.emailOtp.sendVerificationOtp({email,type:'email-verification'}));},
    async requestReset(email){await result(client.auth.emailOtp.requestPasswordReset({email}));},
    async resetPassword(email,otp,password){await result(client.auth.emailOtp.resetPassword({email,otp,password}));},
    async signOut(){await result(client.auth.signOut());},
    async rpc(name,request) {
      if(!['study_pull','study_sync','study_exam','study_reset'].includes(name))throw new TypeError('지원하지 않는 계정 작업입니다.');
      return result(client.rpc(name,request?{p_request:request}:{}).abortSignal(AbortSignal.timeout(20000)));
    }
  };
}
