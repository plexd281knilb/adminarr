"use client"

import { useState, useEffect } from "react";
import { 
    getSubscribers, 
    updateSubscriber, 
    deleteSubscriber, 
    addManualSubscriber, 
    bulkUpdateSubscribers, 
    clearIgnoreList,
    syncTautulliUsers,
    triggerPaymentScan,
    sendManualEmail
} from "@/app/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog"; 
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
    Search, Plus, Trash2, Edit, Mail, 
    CheckSquare, Square, DollarSign, User, ShieldAlert, RefreshCw, CreditCard, Send, Loader2 
} from "lucide-react";
import { format } from "date-fns";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // User Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Email Modal States
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailUser, setEmailUser] = useState<any>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Load Data
  const loadUsers = async () => {
      setLoading(true);
      const data = await getSubscribers();
      setUsers(data);
      setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  // --- ACTIONS ---

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          // @ts-ignore
          const result = await syncTautulliUsers(); 
          if (result && !result.success) {
              alert("Sync Failed:\n" + result.logs.join("\n"));
          } else {
              await loadUsers();
          }
      } catch (e) {
          console.error(e);
          alert("Sync failed. Check console.");
      }
      setIsSyncing(false);
  };

  const handleScan = async () => {
      setIsScanning(true);
      try {
          // @ts-ignore
          const result = await triggerPaymentScan();
          if (result && !result.success) {
               alert("Scan Failed:\n" + result.logs.join("\n"));
          } else {
               await loadUsers(); 
          }
      } catch (e) {
          console.error(e);
          alert("Scan failed. Check console.");
      }
      setIsScanning(false);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData);
      
      if (currentUser) {
          await updateSubscriber(currentUser.id, data);
      } else {
          await addManualSubscriber(data);
      }
      setIsEditOpen(false);
      setIsAddOpen(false);
      setCurrentUser(null);
      loadUsers();
  };

  const handleBulkEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const status = formData.get("status");
      const billingCycle = formData.get("billingCycle");
      const nextPaymentDate = formData.get("nextPaymentDate");
      
      await bulkUpdateSubscribers(Array.from(selectedIds), {
          status: status,
          billingCycle: billingCycle,
          nextPaymentDate: nextPaymentDate
      });

      setIsBulkEditOpen(false);
      setSelectedIds(new Set());
      loadUsers();
  };

  const handleDelete = async (id: string) => {
      if (confirm("Are you sure? If this is a synced user, they will be added to the ignore list.")) {
          await deleteSubscriber(id);
          loadUsers();
      }
  };

  const handleBulkDelete = async () => {
      if (confirm(`Delete ${selectedIds.size} users?`)) {
          for (const id of Array.from(selectedIds)) {
              await deleteSubscriber(id);
          }
          setSelectedIds(new Set());
          loadUsers();
      }
  };

  const handleClearIgnore = async () => {
      if (confirm("Clear the Ignore List? Any previously deleted users will reappear if they still exist in Tautulli during the next sync.")) {
          await clearIgnoreList();
          alert("Ignore list cleared. You can now re-sync Tautulli to restore users.");
      }
  };

  // --- EMAIL ACTIONS ---

  const handleEmailClick = (user: any) => {
      if (!user.email) return alert("No email address for this user.");
      setEmailUser(user);
      setIsEmailOpen(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSendingEmail(true);
      const formData = new FormData(e.target as HTMLFormElement);
      
      const result = await sendManualEmail(formData);
      setIsSendingEmail(false);

      if (result?.error) {
          alert(result.error);
      } else {
          alert("Email sent successfully!");
          setIsEmailOpen(false);
          setEmailUser(null);
      }
  };

  // --- TABLE HELPERS ---

  const toggleSelect = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredUsers.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredUsers.map(u => u.id)));
  };

  const filteredUsers = users.filter(u => 
      (u.name?.toLowerCase() || "").includes(search.toLowerCase()) || 
      (u.fullName?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6 px-4 sm:px-6 md:px-8 py-4 md:py-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h2>
            <p className="text-sm md:text-base text-muted-foreground">Track payments, activity, and subscriptions.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push("/payments")} className="flex-1 sm:flex-none">
                <CreditCard className="h-4 w-4 mr-2" /> Tracking
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSync} disabled={isSyncing} className="gap-2 flex-1 sm:flex-none">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Tautulli"}</span>
                <span className="sm:hidden">{isSyncing ? "Syncing..." : "Sync"}</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={handleScan} disabled={isScanning} className="gap-2 flex-1 sm:flex-none">
                <Mail className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{isScanning ? "Scanning..." : "Scan Emails"}</span>
                <span className="sm:hidden">{isScanning ? "Scanning..." : "Scan"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearIgnore} title="Clear Ignore List" className="flex-1 sm:flex-none px-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" />
            </Button>
            <Button size="sm" onClick={() => { setCurrentUser(null); setIsAddOpen(true); }} className="gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Plus className="h-4 w-4" /> Add User
            </Button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center bg-muted/40 p-2 md:p-3 rounded-lg border">
          <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 md:top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name, email..." 
                className="pl-8 bg-background h-9 md:h-10 text-sm md:text-base" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
          </div>
          
          {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto animate-in fade-in slide-in-from-right-5 overflow-x-auto pb-1 sm:pb-0">
                  <Badge variant="secondary" className="mr-2 whitespace-nowrap shrink-0">{selectedIds.size} Selected</Badge>
                  <Button size="sm" onClick={() => setIsBulkEditOpen(true)} className="shrink-0 h-8">
                      <Edit className="h-3.5 w-3.5 mr-2"/> Bulk Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="shrink-0 h-8">
                      <Trash2 className="h-3.5 w-3.5"/>
                  </Button>
              </div>
          )}
      </div>

      {/* USERS TABLE */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="w-full overflow-x-auto pb-2">
            <table className="w-full text-sm text-left min-w-[850px]">
                <thead className="text-xs uppercase bg-muted/50 text-muted-foreground whitespace-nowrap border-b">
                    <tr>
                        <th className="px-3 py-3 md:px-4 w-10">
                            <button onClick={toggleSelectAll} className="flex items-center justify-center">
                                {selectedIds.size === filteredUsers.length && filteredUsers.length > 0 ? <CheckSquare className="h-4 w-4"/> : <Square className="h-4 w-4"/>}
                            </button>
                        </th>
                        <th className="px-3 py-3 md:px-4">Subscriber</th>
                        <th className="px-3 py-3 md:px-4">Cycle</th>
                        <th className="px-3 py-3 md:px-4">Status</th>
                        <th className="px-3 py-3 md:px-4">Last Watched</th>
                        <th className="px-3 py-3 md:px-4">Payment</th>
                        <th className="px-3 py-3 md:px-4">Due Date</th>
                        <th className="px-3 py-3 md:px-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {loading ? (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading users...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                    ) : (
                        filteredUsers.map((user) => (
                            <tr key={user.id} className={`hover:bg-muted/50 transition-colors ${selectedIds.has(user.id) ? "bg-muted" : ""}`}>
                                <td className="px-3 py-3 md:px-4">
                                    <button onClick={() => toggleSelect(user.id)} className="flex items-center justify-center">
                                        {selectedIds.has(user.id) ? <CheckSquare className="h-4 w-4 text-primary"/> : <Square className="h-4 w-4 text-muted-foreground"/>}
                                    </button>
                                </td>
                                <td className="px-3 py-3 md:px-4 min-w-[200px]">
                                    <div className="flex items-center gap-3">
                                        {user.avatarUrl ? (
                                            <img src={user.avatarUrl} alt="" className="h-8 w-8 md:h-10 md:w-10 rounded-full object-cover bg-slate-200 shrink-0" />
                                        ) : (
                                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                                {user.name?.[0]?.toUpperCase() || "?"}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm md:text-base truncate">
                                                {user.fullName || user.name}
                                            </div>
                                            {user.fullName && user.fullName !== user.name && (
                                                <div className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1 truncate">
                                                    <User className="h-3 w-3 shrink-0"/> {user.name}
                                                </div>
                                            )}
                                            <div className="text-[10px] md:text-xs text-muted-foreground truncate">{user.email || "No Email"}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3 py-3 md:px-4">
                                    <Badge variant="outline" className={`whitespace-nowrap ${user.billingCycle === "Yearly" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                        {user.billingCycle || "Monthly"}
                                    </Badge>
                                </td>
                                <td className="px-3 py-3 md:px-4">
                                    {user.status === "Exempt" ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">Exempt</Badge>
                                    ) : (
                                        <Badge variant={user.status === "Active" ? "default" : user.status === "Overdue" ? "destructive" : "secondary"} className="whitespace-nowrap">
                                            {user.status}
                                        </Badge>
                                    )}
                                </td>
                                <td className="px-3 py-3 md:px-4">
                                    <div className="text-xs whitespace-nowrap">
                                        {user.lastWatched ? format(new Date(user.lastWatched), "MMM d, yyyy") : "Never"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={user.lastWatchedTitle}>
                                        {user.lastWatchedTitle || "-"}
                                    </div>
                                </td>
                                <td className="px-3 py-3 md:px-4">
                                    {user.lastPaymentDate ? (
                                        <div>
                                            <div className="text-xs font-medium flex items-center">
                                                <DollarSign className="h-3 w-3 mr-0.5"/>
                                                {user.lastPaymentAmount?.toFixed(2)}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {format(new Date(user.lastPaymentDate), "MMM d")}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                </td>
                                <td className="px-3 py-3 md:px-4">
                                    {user.nextPaymentDate && (
                                        <div className={`text-xs whitespace-nowrap ${new Date(user.nextPaymentDate) < new Date() ? "text-red-600 font-bold" : ""}`}>
                                            {format(new Date(user.nextPaymentDate), "MMM d, yyyy")}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-3 md:px-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEmailClick(user)} title="Email User">
                                            <Mail className="h-4 w-4"/>
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setCurrentUser(user); setIsEditOpen(true); }} title="Edit User">
                                            <Edit className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      {/* --- MODALS --- */}
      {/* EDIT / ADD MODAL */}
      <Dialog open={isEditOpen || isAddOpen} onOpenChange={(val) => { if(!val) { setIsEditOpen(false); setIsAddOpen(false); } }}>
        <DialogContent className="w-[95vw] max-w-[500px] p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
            <DialogHeader>
                <DialogTitle>{isEditOpen ? "Edit User" : "Add Manual User"}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                    Update subscription details and payment status.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveUser} className="space-y-4 py-2 sm:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Real Name (Payment)</Label>
                        <Input name="fullName" defaultValue={currentUser?.fullName} placeholder="e.g. John Doe" className="h-9"/>
                    </div>
                    <div className="space-y-2">
                        <Label>Plex Username</Label>
                        <Input name="name" defaultValue={currentUser?.name} required placeholder="e.g. movie_fan_99" className="h-9"/>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" defaultValue={currentUser?.email} className="h-9"/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <Select name="status" defaultValue={currentUser?.status || "Active"}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Overdue">Overdue</SelectItem>
                                <SelectItem value="Disabled">Disabled</SelectItem>
                                <SelectItem value="Exempt">Exempt</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <Select name="billingCycle" defaultValue={currentUser?.billingCycle || "Monthly"}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Yearly">Yearly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                        <Label>Next Due Date</Label>
                        <Input name="nextPaymentDate" type="date" defaultValue={currentUser?.nextPaymentDate ? format(new Date(currentUser.nextPaymentDate), "yyyy-MM-dd") : ""} className="h-9 w-full block"/>
                    </div>
                </div>
                <div className="border-t pt-4 mt-2">
                    <h4 className="text-sm font-medium mb-3">Record Recent Payment</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Amount ($)</Label>
                            <Input name="lastPaymentAmount" type="number" step="0.01" defaultValue={currentUser?.lastPaymentAmount} className="h-9"/>
                        </div>
                        <div className="space-y-2">
                            <Label>Date Received</Label>
                            <Input name="lastPaymentDate" type="date" defaultValue={currentUser?.lastPaymentDate ? format(new Date(currentUser.lastPaymentDate), "yyyy-MM-dd") : ""} className="h-9 block w-full"/>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Private Notes</Label>
                    <Input name="notes" placeholder="Internal tracking notes..." defaultValue={currentUser?.notes} className="h-9"/>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between mt-4">
                    {isEditOpen && (
                        <Button type="button" variant="destructive" onClick={() => { handleDelete(currentUser.id); setIsEditOpen(false); }} className="w-full sm:w-auto order-last sm:order-first">
                            Delete User
                        </Button>
                    )}
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => { setIsEditOpen(false); setIsAddOpen(false); }}>Cancel</Button>
                        <Button type="submit" className="flex-1 sm:flex-none">Save</Button>
                    </div>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* BULK EDIT MODAL */}
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="w-[90vw] max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Bulk Edit Users</DialogTitle>
                <DialogDescription>
                    Update {selectedIds.size} users. Leave fields blank to keep current values.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleBulkEdit} className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>New Status</Label>
                        <Select name="status" defaultValue="no-change">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-change">-- Keep Current --</SelectItem>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Overdue">Overdue</SelectItem>
                                <SelectItem value="Disabled">Disabled</SelectItem>
                                <SelectItem value="Exempt">Exempt</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Billing Cycle</Label>
                        <Select name="billingCycle" defaultValue="no-change">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="no-change">-- Keep Current --</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Yearly">Yearly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>New Due Date</Label>
                    <Input name="nextPaymentDate" type="date" className="block w-full"/>
                    <p className="text-[10px] text-muted-foreground">Leave blank to keep existing dates.</p>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsBulkEditOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button type="submit" className="w-full sm:w-auto">Update {selectedIds.size} Users</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* EMAIL MODAL */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="w-[90vw] max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Email {emailUser?.name}</DialogTitle>
                <DialogDescription>
                    Send an email via the configured SMTP server.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendEmail} className="space-y-4 py-2">
                <input type="hidden" name="to" value={emailUser?.email || ""} />
                
                <div className="space-y-2">
                    <Label>To</Label>
                    <Input disabled value={emailUser?.email || "No email on file"} />
                </div>

                <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input name="subject" placeholder="Important Notice" required />
                </div>

                <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea name="message" placeholder="Type your message here..." rows={5} required />
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEmailOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button type="submit" disabled={isSendingEmail || !emailUser?.email} className="w-full sm:w-auto">
                        {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}
                        Send Email
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}