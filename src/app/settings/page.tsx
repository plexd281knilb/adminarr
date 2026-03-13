"use client";

import { useState, useEffect } from "react";
import { 
    // Auth
    getAppUsers, createAppUser, deleteAppUser, 
    // General Settings
    getSettings, saveSettings, saveFeeSettings, saveJobSettings, 
    // Email (Scanning)
    getEmailAccounts, addEmailAccount, deleteEmailAccount, 
    // Integrations
    getTautulliInstances, addTautulliInstance, removeTautulliInstance,
    getGlancesInstances, addGlancesInstance, removeGlancesInstance,
    getMediaAppsList, addMediaApp, removeMediaApp
} from "@/app/actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Shield, User, Mail, Send } from "lucide-react";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    
    // Data States
    const [users, setUsers] = useState<any[]>([]);
    const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
    const [systemSettings, setSystemSettings] = useState<any>({});
    
    // App States
    const [tautulli, setTautulli] = useState<any[]>([]);
    const [glances, setGlances] = useState<any[]>([]);
    const [mediaApps, setMediaApps] = useState<any[]>([]);

    const loadAllData = async () => {
        setLoading(true);
        const [u, e, s, t, g, m] = await Promise.all([
            getAppUsers(),
            getEmailAccounts(),
            getSettings(),
            getTautulliInstances(),
            getGlancesInstances(),
            getMediaAppsList()
        ]);
        setUsers(u);
        setEmailAccounts(e);
        setSystemSettings(s || {});
        setTautulli(t);
        setGlances(g);
        setMediaApps(m);
        setLoading(false);
    };

    useEffect(() => { loadAllData(); }, []);

    // --- HANDLERS ---
    const handleForm = async (e: React.FormEvent, action: Function) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        await action(formData); 
        (e.target as HTMLFormElement).reset();
        loadAllData();
    };

    const handleObjectForm = async (e: React.FormEvent, action: Function) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        await action(Object.fromEntries(formData)); 
        (e.target as HTMLFormElement).reset();
        loadAllData();
    };

    const handleDelete = async (id: string, action: Function) => {
        if(confirm("Are you sure?")) {
            await action(id);
            loadAllData();
        }
    };

    const handleSaveFees = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        
        const monthly = parseFloat(formData.get("monthlyFee") as string) || 0;
        const yearly = parseFloat(formData.get("yearlyFee") as string) || 0;
        
        await saveFeeSettings(monthly, yearly);
        
        alert("Fee settings saved.");
        loadAllData();
    };

    return (
        <div className="space-y-6 p-8 max-w-6xl mx-auto pb-12">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
                <p className="text-muted-foreground">Configure the platform, integrations, and access.</p>
            </div>

            <Tabs defaultValue="general" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                    <TabsTrigger value="general">General & SMTP</TabsTrigger>
                    <TabsTrigger value="access">Access Control</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    <TabsTrigger value="payments">Payment Scanning</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: GENERAL & SMTP --- */}
                <TabsContent value="general" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* SMTP SETTINGS */}
                        <Card className="col-span-2 md:col-span-1">
                            <CardHeader>
                                <CardTitle>SMTP Settings (Sending)</CardTitle>
                                <CardDescription>Used for sending welcome emails and notifications.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={(e) => handleForm(e, saveSettings)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>SMTP Host</Label><Input name="smtpHost" defaultValue={systemSettings.smtpHost} placeholder="smtp.gmail.com"/></div>
                                        <div className="space-y-2"><Label>Port</Label><Input name="smtpPort" defaultValue={systemSettings.smtpPort} placeholder="587"/></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>User</Label><Input name="smtpUser" defaultValue={systemSettings.smtpUser} placeholder="user@gmail.com"/></div>
                                        <div className="space-y-2"><Label>Password</Label><Input name="smtpPass" type="password" defaultValue={systemSettings.smtpPass}/></div>
                                    </div>
                                    <Button type="submit"><Send className="h-4 w-4 mr-2"/> Save SMTP</Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* FEES & JOB INTERVAL */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSaveFees} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2"><Label>Monthly ($)</Label><Input name="monthlyFee" type="number" step="0.01" defaultValue={systemSettings.monthlyFee}/></div>
                                            <div className="space-y-2"><Label>Yearly ($)</Label><Input name="yearlyFee" type="number" step="0.01" defaultValue={systemSettings.yearlyFee}/></div>
                                        </div>
                                        <Button type="submit" variant="secondary" className="w-full">Update Fees</Button>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader><CardTitle>Automation</CardTitle></CardHeader>
                                <CardContent>
                                    <form onSubmit={(e) => handleForm(e, saveJobSettings)} className="flex gap-4 items-end">
                                        <div className="space-y-2 flex-1">
                                            <Label>Scan Interval (Hours)</Label>
                                            <Input name="autoSyncInterval" type="number" defaultValue={systemSettings.autoSyncInterval || 24} />
                                        </div>
                                        <Button type="submit" variant="secondary">Save</Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: ACCESS CONTROL --- */}
                <TabsContent value="access" className="space-y-4">
                     <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Create Account</CardTitle>
                                <CardDescription>Add a new administrator.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={(e) => handleForm(e, createAppUser)} className="space-y-4">
                                    <div className="space-y-2"><Label>Username</Label><Input name="username" required autoComplete="off" /></div>
                                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required autoComplete="off" /></div>
                                    <div className="space-y-2"><Label>Password</Label><Input name="password" type="password" required autoComplete="new-password" /></div>
                                    <div className="space-y-2">
                                        <Label>Role</Label>
                                        <Select name="role" defaultValue="USER">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="USER">User</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="submit" className="w-full"><UserPlus className="h-4 w-4 mr-2"/> Create</Button>
                                </form>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Existing Users</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                                    {users.map((user) => (
                                        <div key={user.id} className="flex justify-between items-center border p-3 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">{user.role === "ADMIN" ? <Shield className="h-4 w-4"/> : <User className="h-4 w-4"/>}</div>
                                                <div><div className="font-medium">{user.username}</div><div className="text-xs text-muted-foreground">{user.email}</div></div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDelete(user.id, deleteAppUser)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 3: INTEGRATIONS --- */}
                <TabsContent value="integrations" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        
                        {/* GLANCES */}
                        <Card>
                            <CardHeader><CardTitle>Glances (Hardware)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                    {glances.length === 0 && <div className="text-sm italic text-muted-foreground">No instances configured.</div>}
                                    {glances.map(g => (
                                        <div key={g.id} className="flex justify-between items-center border p-2 rounded text-sm">
                                            <span className="truncate">{g.name}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(g.id, removeGlancesInstance)}><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addGlancesInstance)} className="space-y-2 border-t pt-2">
                                    <Input name="name" placeholder="Name (e.g. Main)" required className="h-8 text-xs"/>
                                    <Input name="url" placeholder="URL (http://...)" required className="h-8 text-xs"/>
                                    <Button type="submit" size="sm" className="w-full">Add Glances</Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* TAUTULLI */}
                        <Card>
                            <CardHeader><CardTitle>Tautulli</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                    {tautulli.length === 0 && <div className="text-sm italic text-muted-foreground">No instances configured.</div>}
                                    {tautulli.map(t => (
                                        <div key={t.id} className="flex justify-between items-center border p-2 rounded text-sm">
                                            <span className="truncate">{t.name}</span>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(t.id, removeTautulliInstance)}><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addTautulliInstance)} className="space-y-2 border-t pt-2">
                                    <Input name="name" placeholder="Name (e.g. Main)" required className="h-8 text-xs"/>
                                    <Input name="url" placeholder="URL (http://...)" required className="h-8 text-xs"/>
                                    <Input name="apiKey" placeholder="API Key" required className="h-8 text-xs"/>
                                    <Button type="submit" size="sm" className="w-full">Add Tautulli</Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* MEDIA APPS */}
                        <Card className="md:col-span-2 lg:col-span-1">
                            <CardHeader><CardTitle>Media Apps (*Arrs)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                    {mediaApps.length === 0 && <div className="text-sm italic text-muted-foreground">No apps configured.</div>}
                                    {mediaApps.map(app => (
                                        <div key={app.id} className="flex justify-between items-center border p-2 rounded text-sm">
                                            <div className="truncate">
                                                <span className="font-semibold">{app.name}</span> <span className="text-muted-foreground text-[10px] uppercase">({app.type})</span>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(app.id, removeMediaApp)}><Trash2 className="h-3 w-3"/></Button>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addMediaApp)} className="space-y-2 border-t pt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input name="name" placeholder="App Name" required className="h-8 text-xs"/>
                                        <Select name="type" defaultValue="sonarr">
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sonarr">Sonarr</SelectItem>
                                                <SelectItem value="radarr">Radarr</SelectItem>
                                                <SelectItem value="lidarr">Lidarr</SelectItem>
                                                <SelectItem value="readarr">Readarr</SelectItem>
                                                <SelectItem value="sabnzbd">SABnzbd</SelectItem>
                                                <SelectItem value="nzbget">NZBGet</SelectItem>
                                                <SelectItem value="overseerr">Overseerr</SelectItem>
                                                <SelectItem value="ombi">Ombi</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Input name="url" placeholder="Internal URL (http://...)" required className="h-8 text-xs"/>
                                    <Input name="apiKey" placeholder="API Key" className="h-8 text-xs"/>
                                    <Button type="submit" size="sm" className="w-full">Add App</Button>
                                </form>
                            </CardContent>
                        </Card>

                    </div>
                </TabsContent>

                {/* --- TAB 4: PAYMENT SCANNING (IMAP) --- */}
                <TabsContent value="payments" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payment Email Scanning (IMAP)</CardTitle>
                            <CardDescription>Connect email accounts to scan for Venmo/PayPal receipts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                {emailAccounts.length === 0 && <div className="text-sm italic text-muted-foreground">No accounts connected.</div>}
                                {emailAccounts.map(acc => (
                                    <div key={acc.id} className="flex justify-between items-center border p-3 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <Mail className="h-5 w-5 text-blue-500"/>
                                            <div>
                                                <div className="font-medium">{acc.name}</div>
                                                <div className="text-xs text-muted-foreground">{acc.host} ({acc.user})</div>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="destructive" onClick={() => handleDelete(acc.id, deleteEmailAccount)}>Disconnect</Button>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Connect New Account</h4>
                                <form onSubmit={(e) => handleObjectForm(e, addEmailAccount)} className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2"><Label>Name</Label><Input name="name" placeholder="Payment Inbox" required /></div>
                                    <div className="space-y-2"><Label>Host</Label><Input name="host" placeholder="imap.gmail.com" required /></div>
                                    <div className="space-y-2"><Label>User</Label><Input name="user" placeholder="email@gmail.com" required /></div>
                                    <div className="space-y-2"><Label>Password</Label><Input name="pass" type="password" required /></div>
                                    <div className="space-y-2"><Label>Port</Label><Input name="port" defaultValue="993" required /></div>
                                    <div className="flex items-end"><Button type="submit" className="w-full">Connect</Button></div>
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}