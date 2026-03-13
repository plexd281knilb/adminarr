"use client";

import { useState, useEffect } from "react";
import { 
    getAppUsers, createAppUser, deleteAppUser, updateAppUser,
    getSettings, saveSettings, saveFeeSettings, saveJobSettings, 
    getEmailAccounts, addEmailAccount, deleteEmailAccount, updateEmailAccount,
    getTautulliInstances, addTautulliInstance, removeTautulliInstance, updateTautulliInstance,
    getGlancesInstances, addGlancesInstance, removeGlancesInstance, updateGlancesInstance,
    getMediaAppsList, addMediaApp, removeMediaApp, updateMediaApp
} from "@/app/actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, UserPlus, Shield, User, Mail, Send, Edit } from "lucide-react";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
    const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
    const [systemSettings, setSystemSettings] = useState<any>({});
    const [tautulli, setTautulli] = useState<any[]>([]);
    const [glances, setGlances] = useState<any[]>([]);
    const [mediaApps, setMediaApps] = useState<any[]>([]);

    // Edit Modal State (Added "user" to the types)
    const [editModal, setEditModal] = useState<{type: "glances" | "tautulli" | "mediaApp" | "email" | "user" | null, data: any}>({type: null, data: null});

    const loadAllData = async () => {
        setLoading(true);
        const [u, e, s, t, g, m] = await Promise.all([
            getAppUsers(), getEmailAccounts(), getSettings(),
            getTautulliInstances(), getGlancesInstances(), getMediaAppsList()
        ]);
        setUsers(u); setEmailAccounts(e); setSystemSettings(s || {});
        setTautulli(t); setGlances(g); setMediaApps(m);
        setLoading(false);
    };

    useEffect(() => { loadAllData(); }, []);

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

    const handleEditSubmit = async (e: React.FormEvent, action: Function, isObject = false) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        if (isObject) {
            await action(Object.fromEntries(formData));
        } else {
            await action(formData);
        }
        setEditModal({type: null, data: null});
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
        <div className="space-y-4 md:space-y-6 px-4 sm:px-6 md:px-8 py-4 md:py-8 max-w-6xl mx-auto pb-12">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">System Settings</h2>
                <p className="text-sm md:text-base text-muted-foreground">Configure the platform, integrations, and access.</p>
            </div>

            <Tabs defaultValue="general" className="space-y-4 md:space-y-6">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 h-auto gap-1 p-1 bg-muted/50">
                    <TabsTrigger value="general" className="text-xs md:text-sm">General & SMTP</TabsTrigger>
                    <TabsTrigger value="access" className="text-xs md:text-sm">Access Control</TabsTrigger>
                    <TabsTrigger value="integrations" className="text-xs md:text-sm">Integrations</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs md:text-sm">Payment Scanning</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: GENERAL & SMTP --- */}
                <TabsContent value="general" className="space-y-4">
                    <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>SMTP Settings (Sending)</CardTitle>
                                <CardDescription>Used for sending welcome emails and notifications.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={(e) => handleForm(e, saveSettings)} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>SMTP Host</Label><Input name="smtpHost" defaultValue={systemSettings.smtpHost} placeholder="smtp.gmail.com"/></div>
                                        <div className="space-y-2"><Label>Port</Label><Input name="smtpPort" defaultValue={systemSettings.smtpPort} placeholder="587"/></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>User</Label><Input name="smtpUser" defaultValue={systemSettings.smtpUser} placeholder="user@gmail.com"/></div>
                                        <div className="space-y-2"><Label>Password</Label><Input name="smtpPass" type="password" defaultValue={systemSettings.smtpPass}/></div>
                                    </div>
                                    <Button type="submit" className="w-full sm:w-auto"><Send className="h-4 w-4 mr-2"/> Save SMTP</Button>
                                </form>
                            </CardContent>
                        </Card>

                        <div className="space-y-4 md:space-y-6">
                            <Card>
                                <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
                                <CardContent>
                                    <form onSubmit={handleSaveFees} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <form onSubmit={(e) => handleForm(e, saveJobSettings)} className="flex flex-col sm:flex-row sm:items-end gap-4">
                                        <div className="space-y-2 flex-1">
                                            <Label>Scan Interval (Hours)</Label>
                                            <Input name="autoSyncInterval" type="number" defaultValue={systemSettings.autoSyncInterval || 24} />
                                        </div>
                                        <Button type="submit" variant="secondary" className="w-full sm:w-auto">Save</Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: ACCESS CONTROL --- */}
                <TabsContent value="access" className="space-y-4">
                     <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
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
                                    <Button type="submit" className="w-full"><UserPlus className="h-4 w-4 mr-2"/> Create Account</Button>
                                </form>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Existing Users</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {users.map((user) => (
                                        <div key={user.id} className="flex justify-between items-center border p-3 rounded-lg">
                                            <div className="flex items-center gap-3 min-w-0 pr-2">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">{user.role === "ADMIN" ? <Shield className="h-4 w-4"/> : <User className="h-4 w-4"/>}</div>
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{user.username}</div>
                                                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500" onClick={() => setEditModal({type: "user", data: user})}><Edit className="h-4 w-4"/></Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(user.id, deleteAppUser)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 3: INTEGRATIONS --- */}
                <TabsContent value="integrations" className="space-y-4">
                    <div className="grid gap-4 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
                        <Card>
                            <CardHeader><CardTitle>Glances (Hardware)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                    {glances.length === 0 && <div className="text-sm italic text-muted-foreground">No instances configured.</div>}
                                    {glances.map(g => (
                                        <div key={g.id} className="flex justify-between items-center border p-2 rounded text-sm gap-2">
                                            <span className="truncate flex-1">{g.name}</span>
                                            <div className="flex gap-1 shrink-0">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditModal({type: "glances", data: g})}><Edit className="h-3 w-3"/></Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(g.id, removeGlancesInstance)}><Trash2 className="h-3 w-3"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addGlancesInstance)} className="space-y-2 border-t pt-2">
                                    <Input name="name" placeholder="Name (e.g. Main)" required className="h-9 text-sm"/>
                                    <Input name="url" placeholder="URL (http://...)" required className="h-9 text-sm"/>
                                    <Button type="submit" size="sm" className="w-full">Add Glances</Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Tautulli</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                    {tautulli.length === 0 && <div className="text-sm italic text-muted-foreground">No instances configured.</div>}
                                    {tautulli.map(t => (
                                        <div key={t.id} className="flex justify-between items-center border p-2 rounded text-sm gap-2">
                                            <span className="truncate flex-1">{t.name}</span>
                                            <div className="flex gap-1 shrink-0">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditModal({type: "tautulli", data: t})}><Edit className="h-3 w-3"/></Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(t.id, removeTautulliInstance)}><Trash2 className="h-3 w-3"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addTautulliInstance)} className="space-y-2 border-t pt-2">
                                    <Input name="name" placeholder="Name (e.g. Main)" required className="h-9 text-sm"/>
                                    <Input name="url" placeholder="URL (http://...)" required className="h-9 text-sm"/>
                                    <Input name="apiKey" placeholder="API Key" required className="h-9 text-sm"/>
                                    <Button type="submit" size="sm" className="w-full">Add Tautulli</Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 xl:col-span-1">
                            <CardHeader><CardTitle>Media Apps (*Arrs)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                                    {mediaApps.length === 0 && <div className="text-sm italic text-muted-foreground">No apps configured.</div>}
                                    {mediaApps.map(app => (
                                        <div key={app.id} className="flex justify-between items-center border p-2 rounded text-sm gap-2">
                                            <div className="truncate flex-1">
                                                <span className="font-semibold">{app.name}</span> <span className="text-muted-foreground text-[10px] uppercase">({app.type})</span>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditModal({type: "mediaApp", data: app})}><Edit className="h-3 w-3"/></Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(app.id, removeMediaApp)}><Trash2 className="h-3 w-3"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={(e) => handleForm(e, addMediaApp)} className="space-y-2 border-t pt-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input name="name" placeholder="App Name" required className="h-9 text-sm"/>
                                        <Select name="type" defaultValue="sonarr">
                                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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
                                    <Input name="url" placeholder="Internal URL (http://...)" required className="h-9 text-sm"/>
                                    <Input name="apiKey" placeholder="API Key" className="h-9 text-sm"/>
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
                            <div className="space-y-3">
                                {emailAccounts.length === 0 && <div className="text-sm italic text-muted-foreground">No accounts connected.</div>}
                                {emailAccounts.map(acc => (
                                    <div key={acc.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center border p-3 rounded-md gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Mail className="h-5 w-5 text-blue-500 shrink-0"/>
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{acc.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{acc.host} ({acc.user})</div>
                                            </div>
                                        </div>
                                        <div className="flex w-full sm:w-auto gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setEditModal({type: "email", data: acc})}>Edit</Button>
                                            <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleDelete(acc.id, deleteEmailAccount)}>Disconnect</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Connect New Account</h4>
                                <form onSubmit={(e) => handleObjectForm(e, addEmailAccount)} className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2"><Label>Name</Label><Input name="name" placeholder="Payment Inbox" required /></div>
                                    <div className="space-y-2"><Label>Host</Label><Input name="host" placeholder="imap.gmail.com" required /></div>
                                    <div className="space-y-2"><Label>User</Label><Input name="user" placeholder="email@gmail.com" required /></div>
                                    <div className="space-y-2"><Label>Password</Label><Input name="pass" type="password" required /></div>
                                    <div className="space-y-2"><Label>Port</Label><Input name="port" defaultValue="993" required /></div>
                                    <div className="flex items-end"><Button type="submit" className="w-full">Connect Account</Button></div>
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- EDIT MODALS --- */}
            <Dialog open={!!editModal.type} onOpenChange={(val) => !val && setEditModal({type: null, data: null})}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit {editModal.type === "user" ? "User" : "Integration"}</DialogTitle>
                    </DialogHeader>

                    {editModal.type === "user" && (
                        <form onSubmit={(e) => handleEditSubmit(e, updateAppUser)} className="space-y-4 pt-4">
                            <input type="hidden" name="id" value={editModal.data.id} />
                            <div className="space-y-2"><Label>Username</Label><Input name="username" defaultValue={editModal.data.username} required /></div>
                            <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" defaultValue={editModal.data.email} required /></div>
                            <div className="space-y-2"><Label>New Password</Label><Input name="password" type="password" placeholder="Leave blank to keep current password" /></div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <Select name="role" defaultValue={editModal.data.role}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Admin</SelectItem>
                                        <SelectItem value="USER">User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                        </form>
                    )}

                    {editModal.type === "glances" && (
                        <form onSubmit={(e) => handleEditSubmit(e, updateGlancesInstance)} className="space-y-4 pt-4">
                            <input type="hidden" name="id" value={editModal.data.id} />
                            <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editModal.data.name} required /></div>
                            <div className="space-y-2"><Label>URL</Label><Input name="url" defaultValue={editModal.data.url} required /></div>
                            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                        </form>
                    )}

                    {editModal.type === "tautulli" && (
                        <form onSubmit={(e) => handleEditSubmit(e, updateTautulliInstance)} className="space-y-4 pt-4">
                            <input type="hidden" name="id" value={editModal.data.id} />
                            <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editModal.data.name} required /></div>
                            <div className="space-y-2"><Label>URL</Label><Input name="url" defaultValue={editModal.data.url} required /></div>
                            <div className="space-y-2"><Label>API Key</Label><Input name="apiKey" defaultValue={editModal.data.apiKey} required /></div>
                            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                        </form>
                    )}

                    {editModal.type === "mediaApp" && (
                        <form onSubmit={(e) => handleEditSubmit(e, updateMediaApp)} className="space-y-4 pt-4">
                            <input type="hidden" name="id" value={editModal.data.id} />
                            <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editModal.data.name} required /></div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select name="type" defaultValue={editModal.data.type}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                            <div className="space-y-2"><Label>URL</Label><Input name="url" defaultValue={editModal.data.url} required /></div>
                            <div className="space-y-2"><Label>API Key</Label><Input name="apiKey" defaultValue={editModal.data.apiKey} /></div>
                            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                        </form>
                    )}

                    {editModal.type === "email" && (
                        <form onSubmit={(e) => handleEditSubmit(e, updateEmailAccount, true)} className="space-y-4 pt-4">
                            <input type="hidden" name="id" value={editModal.data.id} />
                            <div className="space-y-2"><Label>Name</Label><Input name="name" defaultValue={editModal.data.name} required /></div>
                            <div className="space-y-2"><Label>Host</Label><Input name="host" defaultValue={editModal.data.host} required /></div>
                            <div className="space-y-2"><Label>User</Label><Input name="user" defaultValue={editModal.data.user} required /></div>
                            <div className="space-y-2"><Label>Password</Label><Input name="pass" type="password" defaultValue={editModal.data.pass} required /></div>
                            <div className="space-y-2"><Label>Port</Label><Input name="port" defaultValue={editModal.data.port} required /></div>
                            <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}