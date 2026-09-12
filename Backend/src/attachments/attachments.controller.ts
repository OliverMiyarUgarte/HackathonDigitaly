import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AttachmentDto } from '@telemed/service-contracts';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentRequestDto } from './dto/upload-attachment-request.dto';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @ApiOperation({ summary: 'List attachments for an appointment' })
  @Get('appointments/:id/attachments')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttachmentDto[]> {
    return this.attachmentsService.list(user, id);
  }

  @ApiOperation({ summary: 'Upload an attachment for an appointment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        consultationId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @Post('appointments/:id/attachments')
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadAttachmentRequestDto,
  ): Promise<AttachmentDto> {
    if (!file) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: 'File is required',
      });
    }
    return this.attachmentsService.upload(user, id, file, dto.consultationId);
  }

  @ApiOperation({ summary: 'Download an attachment' })
  @Get('attachments/:id')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const { attachment, stream } =
      await this.attachmentsService.loadForDownload(user, id);
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader('Content-Length', attachment.sizeBytes.toString());
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeFileName(attachment.fileName)}"`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    stream.pipe(response);
  }
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(/[\r\n"\\]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'attachment';
}
