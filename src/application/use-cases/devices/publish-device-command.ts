import type { DeviceCommandPublisher } from '@/application/ports/device-command-publisher.js';
import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { canAccessRobot } from '@/application/use-cases/robots/robot-access.js';
import { DeviceAccessDeniedError, DeviceValidationError } from './errors.js';

export type PublishDeviceCommandInput = {
  deviceId: string;
  userId: string;
  isAdmin?: boolean;
  topic: unknown;
  message: unknown;
};

export type PublishDeviceCommandResult = {
  deviceId: string;
  topic: string;
  message: unknown;
};

export class PublishDeviceCommand {
  constructor(
    private readonly robotRepository: Pick<RobotRepository, 'listForUser'>,
    private readonly commandPublisher: DeviceCommandPublisher
  ) {}

  async execute(command: PublishDeviceCommandInput): Promise<PublishDeviceCommandResult> {
    if (!command.topic || typeof command.topic !== 'string') {
      throw new DeviceValidationError('topic is required and must be a string');
    }

    if (!command.message || typeof command.message !== 'object') {
      throw new DeviceValidationError('message is required and must be an object');
    }

    const hasAccess = await canAccessRobot(this.robotRepository, {
      robotId: command.deviceId,
      userId: command.userId,
      isAdmin: command.isAdmin,
    });

    if (!hasAccess) {
      throw new DeviceAccessDeniedError();
    }

    await this.commandPublisher.initialize(command.deviceId);
    await this.commandPublisher.publish(command.deviceId, command.topic, command.message);

    return {
      deviceId: command.deviceId,
      topic: command.topic,
      message: command.message,
    };
  }
}
