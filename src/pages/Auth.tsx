import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { SECURITY_QUESTIONS } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Lock, HelpCircle, ArrowLeft, CheckCircle } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot';
type ForgotStep = 'username' | 'security' | 'newPassword' | 'success';

export function Auth() {
  const { signIn, signUp, getSecurityQuestion, verifySecurityAnswer, resetPassword } = useAuthContext();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Login form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerSecurityQuestion, setRegisterSecurityQuestion] = useState('');
  const [registerSecurityAnswer, setRegisterSecurityAnswer] = useState('');

  // Forgot password form
  const [forgotStep, setForgotStep] = useState<ForgotStep>('username');
  const [forgotUsername, setForgotUsername] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const result = await signIn(loginUsername, loginPassword);
    if (!result.success) {
      setError(result.error || 'Erro ao fazer login');
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (registerPassword !== registerConfirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    if (!registerSecurityQuestion) {
      setError('Selecione uma pergunta de segurança');
      return;
    }
    
    setIsLoading(true);
    const result = await signUp(
      registerUsername, 
      registerPassword, 
      registerSecurityQuestion, 
      registerSecurityAnswer
    );
    if (!result.success) {
      setError(result.error || 'Erro ao cadastrar');
    }
    setIsLoading(false);
  };

  const handleForgotUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const question = await getSecurityQuestion(forgotUsername);
    if (!question) {
      setError('Usuário não encontrado');
      setIsLoading(false);
      return;
    }
    
    setSecurityQuestion(question);
    setForgotStep('security');
    setIsLoading(false);
  };

  const handleVerifySecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    const isValid = await verifySecurityAnswer(forgotUsername, securityAnswer);
    if (!isValid) {
      setError('Resposta incorreta');
      setIsLoading(false);
      return;
    }
    
    setForgotStep('newPassword');
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (newPassword !== confirmNewPassword) {
      setError('As senhas não coincidem');
      return;
    }
    
    setIsLoading(true);
    const result = await resetPassword(forgotUsername, newPassword);
    if (!result.success) {
      setError(result.error || 'Erro ao redefinir senha');
      setIsLoading(false);
      return;
    }
    
    setForgotStep('success');
    setIsLoading(false);
  };

  const resetForgotFlow = () => {
    setForgotStep('username');
    setForgotUsername('');
    setSecurityQuestion('');
    setSecurityAnswer('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
    setMode('login');
  };

  if (mode === 'forgot') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
            <CardDescription>
              {forgotStep === 'username' && 'Digite seu nome de usuário'}
              {forgotStep === 'security' && 'Responda a pergunta de segurança'}
              {forgotStep === 'newPassword' && 'Crie uma nova senha'}
              {forgotStep === 'success' && 'Senha redefinida com sucesso!'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forgotStep === 'username' && (
              <form onSubmit={handleForgotUsername} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-username">Usuário</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-username"
                      type="text"
                      placeholder="Seu usuário"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    'Continuar'
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={resetForgotFlow}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Button>
              </form>
            )}

            {forgotStep === 'security' && (
              <form onSubmit={handleVerifySecurity} className="space-y-4">
                <div className="space-y-2">
                  <Label>Pergunta de segurança</Label>
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {securityQuestion}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="security-answer">Sua resposta</Label>
                  <div className="relative">
                    <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="security-answer"
                      type="text"
                      placeholder="Digite sua resposta"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar'
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => setForgotStep('username')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </form>
            )}

            {forgotStep === 'newPassword' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Digite a nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type="password"
                      placeholder="Confirme a nova senha"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    'Redefinir Senha'
                  )}
                </Button>
              </form>
            )}

            {forgotStep === 'success' && (
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <p className="text-muted-foreground">
                  Sua senha foi redefinida com sucesso. Agora você pode fazer login com a nova senha.
                </p>
                <Button className="w-full" onClick={resetForgotFlow}>
                  Ir para Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bem-vindo</CardTitle>
          <CardDescription>
            Faça login ou crie uma conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Usuário</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Seu usuário"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Sua senha"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="link" 
                  className="w-full text-sm"
                  onClick={() => setMode('forgot')}
                >
                  Esqueci minha senha
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-username">Usuário</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Escolha um usuário"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Crie uma senha"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm-password">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder="Confirme sua senha"
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Pergunta de Segurança</Label>
                  <Select value={registerSecurityQuestion} onValueChange={setRegisterSecurityQuestion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma pergunta" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECURITY_QUESTIONS.map((question) => (
                        <SelectItem key={question} value={question}>
                          {question}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-security-answer">Resposta de Segurança</Label>
                  <div className="relative">
                    <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-security-answer"
                      type="text"
                      placeholder="Sua resposta"
                      value={registerSecurityAnswer}
                      onChange={(e) => setRegisterSecurityAnswer(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esta pergunta será usada para recuperar sua senha
                  </p>
                </div>
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
