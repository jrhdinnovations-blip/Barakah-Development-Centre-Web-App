import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { createUserAdmin } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route = createFileRoute('/_authenticated/admin/users/create')({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      if (error || !user) throw redirect({ to: '/auth', search: { mode: 'login' } });
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      const role = roleData?.role ?? user.user_metadata?.['role'] ?? 'registered_user';
      if (role !== 'administrator') throw redirect({ to: '/my-swift-move' });
    } catch (err: any) {
      if (err?.isRedirect || err?.to || err?.statusCode) throw err;
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
  },
  component: CreateUserPage,
});

function CreateUserPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'registered_user', password: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.role) {
      toast.error('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      await createUserAdmin({
        data: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone,
          role: form.role as any,
        }
      });
      toast.success(`User ${form.full_name || form.email} created successfully!`);
      navigate({ to: '/admin/users' as any });
    } catch (e: any) {
      toast.error('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/admin/users' as any })} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl"><UserPlus className="h-6 w-6 text-blue-400" /></div>
              Biodata Registration
            </h1>
            <p className="text-slate-400 text-sm mt-1">Register a new user by filling their biodata</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-800 bg-[#0a0f1c] p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name (Biodata)</label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Amina Bello" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address <span className="text-red-400">*</span></label>
            <Input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@barakahdevcentre.com" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="080XXXXXXXX" className="mt-1.5 bg-slate-900 border-slate-700 h-11" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assign Role <span className="text-red-400">*</span></label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger className="mt-1.5 bg-slate-900 border-slate-700 h-11"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="registered_user">Customer / User</SelectItem>
                <SelectItem value="driver">Driver / Rider</SelectItem>
                <SelectItem value="swift_dispatcher">Dispatcher</SelectItem>
                <SelectItem value="swift_manager">Swift Manager</SelectItem>
                <SelectItem value="administrator">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporary Password <span className="text-red-400">*</span></label>
            <div className="relative mt-1.5">
              <Input type={showPass ? 'text' : 'password'} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" className="bg-slate-900 border-slate-700 h-11 pr-11" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 h-12 font-bold gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? 'Registering Biodata…' : 'Register User Biodata'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
