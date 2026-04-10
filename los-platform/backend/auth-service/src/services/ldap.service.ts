import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities';
import { UserRole } from '@los/common';
import * as ldap from 'ldapjs';

export interface LdapUser {
  dn: string;
  cn: string;
  mail?: string;
  employeeID?: string;
  department?: string;
  title?: string;
  branchCode?: string;
  mobile?: string;
}

export interface LdapAuthResult {
  success: boolean;
  user?: LdapUser;
  error?: string;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);
  private readonly ldapUrl: string;
  private readonly baseDn: string;
  private readonly bindDn: string;
  private readonly bindPassword: string;
  private readonly userSearchFilter: string;
  private readonly userSearchBase: string;
  private readonly useTLS: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.ldapUrl = this.configService.get<string>('LDAP_URL', 'ldap://ldap.bank.internal:389');
    this.baseDn = this.configService.get<string>('LDAP_BASE_DN', 'dc=bank,dc=internal');
    this.bindDn = this.configService.get<string>('LDAP_BIND_DN', 'cn=los-service,ou=service-accounts,dc=bank,dc=internal');
    this.bindPassword = this.configService.get<string>('LDAP_BIND_PASSWORD', '');
    this.userSearchFilter = this.configService.get<string>('LDAP_USER_FILTER', '(sAMAccountName={{username}})');
    this.userSearchBase = this.configService.get<string>('LDAP_USER_SEARCH_BASE', 'ou=users,dc=bank,dc=internal');
    this.useTLS = this.configService.get<boolean>('LDAP_USE_TLS', false);
  }

  async authenticate(username: string, password: string): Promise<LdapAuthResult> {
    if (!username || !password) {
      return { success: false, error: 'Username and password are required' };
    }

    const client = ldap.createClient({
      url: this.ldapUrl,
      timeout: 10000,
      connectTimeout: 10000,
    });

    try {
      await this.bindServiceAccount(client);

      const filter = this.userSearchFilter.replace('{{username}}', username);
      const userEntry = await this.searchUser(client, filter);

      if (!userEntry) {
        return { success: false, error: 'User not found in LDAP directory' };
      }

      await this.verifyUserPassword(client, userEntry.dn, password);

      const ldapUser = this.parseUserEntry(userEntry);
      this.logger.log(`LDAP authentication successful for: ${username}`);

      return { success: true, user: ldapUser };
    } catch (error) {
      this.logger.warn(`LDAP auth failed for ${username}: ${error.message}`);
      return { success: false, error: this.mapLdapError(error) };
    } finally {
      client.unbind();
    }
  }

  private bindServiceAccount(client: ldap.Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(this.bindDn, this.bindPassword, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private searchUser(client: ldap.Client, filter: string): Promise<ldap.SearchEntryResource | null> {
    return new Promise((resolve, reject) => {
      const opts: ldap.SearchOptions = {
        filter,
        scope: 'sub',
        attributes: [
          'dn', 'cn', 'mail', 'employeeID', 'department',
          'title', 'mobile', 'telephoneNumber', 'l', 'branchCode',
          'sAMAccountName', 'userAccountControl', 'memberOf',
        ],
      };

      const entries: ldap.SearchEntryResource[] = [];

      client.search(this.userSearchBase, opts, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        res.on('searchEntry', (entry) => entries.push(entry));
        res.on('error', (err) => reject(err));
        res.on('end', () => resolve(entries[0] || null));
      });
    });
  }

  private verifyUserPassword(client: ldap.Client, userDn: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const userClient = ldap.createClient({
        url: this.ldapUrl,
        timeout: 10000,
        connectTimeout: 10000,
      });

      userClient.bind(userDn, password, (err) => {
        userClient.unbind();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private parseUserEntry(entry: ldap.SearchEntryResource): LdapUser {
    const getAttr = (name: string): string | undefined => {
      const attr = entry.attributes?.find((a) => a.type === name);
      const vals = attr?.values as string[] | undefined;
      return vals?.[0];
    };

    const dn = entry.objectName || entry.dn;

    return {
      dn: String(dn),
      cn: getAttr('cn') || '',
      mail: getAttr('mail'),
      employeeID: getAttr('employeeID'),
      department: getAttr('department'),
      title: getAttr('title'),
      branchCode: getAttr('l') || this.inferBranchCode(getAttr('department')),
      mobile: getAttr('mobile') || getAttr('telephoneNumber'),
    };
  }

  private inferBranchCode(department?: string): string | undefined {
    if (!department) return undefined;
    const match = department.match(/Branch[\s-]*([A-Z]{2}\d{3})/i);
    return match?.[1]?.toUpperCase();
  }

  private mapLdapError(error: any): string {
    const message = error?.message || String(error);
    if (message.includes('INVALID_CREDENTIALS') || message.includes('49')) {
      return 'Invalid username or password';
    }
    if (message.includes('NO_SUCH_OBJECT') || message.includes('32')) {
      return 'User not found in directory';
    }
    if (message.includes('SIZE_LIMIT') || message.includes('4')) {
      return 'Search returned too many results';
    }
    if (message.includes('CONNECT') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
      return 'Unable to connect to authentication server';
    }
    return 'Authentication failed';
  }

  async syncLdapUserToDatabase(ldapUser: LdapUser, role: UserRole): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { employeeId: ldapUser.employeeID },
    });

    if (user) {
      user.fullName = ldapUser.cn;
      user.email = ldapUser.mail;
      user.mobile = ldapUser.mobile?.replace(/\D/g, '').slice(-10) || user.mobile;
      user.branchCode = ldapUser.branchCode || user.branchCode;
      user.lastLoginAt = new Date();
      user.status = UserStatus.ACTIVE;
    } else {
      user = this.userRepository.create({
        employeeId: ldapUser.employeeID,
        fullName: ldapUser.cn,
        email: ldapUser.mail,
        mobile: ldapUser.mobile?.replace(/\D/g, '').slice(-10) || '',
        role,
        status: UserStatus.ACTIVE,
        branchCode: ldapUser.branchCode,
        lastLoginAt: new Date(),
        mobileHash: '',
        failedLoginAttempts: 0,
      });
    }

    return this.userRepository.save(user);
  }

  async isLdapAvailable(): Promise<boolean> {
    const client = ldap.createClient({
      url: this.ldapUrl,
      timeout: 5000,
      connectTimeout: 5000,
    });

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        client.unbind();
        resolve(false);
      }, 5000);

      client.bind(this.bindDn, this.bindPassword, (err) => {
        clearTimeout(timer);
        client.unbind();
        resolve(!err);
      });
    });
  }
}
