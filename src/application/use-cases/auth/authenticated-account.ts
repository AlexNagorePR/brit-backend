export type AuthenticatedAccount = {
  _id: string;
  email?: string;
  admin?: boolean;
  verified?: boolean;
  created?: Date;
};
