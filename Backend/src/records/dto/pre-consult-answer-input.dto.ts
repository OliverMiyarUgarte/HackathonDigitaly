import { ApiProperty } from '@nestjs/swagger';
import {
  PRE_CONSULT_QUESTION_KEYS,
  type PreConsultAnswerInputDto as PreConsultAnswerInput,
  type PreConsultQuestionKey,
} from '@telemed/service-contracts';
import { IsIn, IsString, Length } from 'class-validator';

export class PreConsultAnswerInputDto implements PreConsultAnswerInput {
  @ApiProperty({ enum: PRE_CONSULT_QUESTION_KEYS })
  @IsIn(PRE_CONSULT_QUESTION_KEYS)
  questionKey!: PreConsultQuestionKey;

  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  answer!: string;
}
