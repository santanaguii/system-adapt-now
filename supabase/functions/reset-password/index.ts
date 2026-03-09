import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type ResetPasswordRequest = {
  username?: string;
  securityAnswer?: string;
  newPassword?: string;
};

function jsonResponse(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function hashString(value: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((item) => item.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Variáveis do Supabase não configuradas.' });
    }

    const { username, securityAnswer, newPassword } = await request.json() as ResetPasswordRequest;

    if (!username?.trim() || !securityAnswer?.trim() || !newPassword) {
      return jsonResponse(400, { error: 'Usuário, resposta e nova senha são obrigatórios.' });
    }

    if (newPassword.length < 6) {
      return jsonResponse(400, { error: 'Senha deve ter pelo menos 6 caracteres.' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const normalizedUsername = username.trim();
    const normalizedAnswer = securityAnswer.toLowerCase().trim();
    const answerHash = await hashString(normalizedAnswer);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, security_answer_hash')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading profile:', profileError);
      return jsonResponse(500, { error: 'Erro ao localizar usuário.' });
    }

    if (!profile || profile.security_answer_hash !== answerHash) {
      return jsonResponse(401, { error: 'Resposta de segurança inválida.' });
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);
      return jsonResponse(500, { error: 'Erro ao redefinir senha.' });
    }

    return jsonResponse(200, { success: 'ok' });
  } catch (error) {
    console.error('Unexpected reset password error:', error);
    return jsonResponse(500, { error: 'Erro inesperado ao redefinir senha.' });
  }
});
